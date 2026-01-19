/**
 * Product variant attribute query functions.
 *
 * Manages the relationship between variants and brand attribute values.
 * Supports both explicit variant creation and matrix (cartesian product) generation.
 */

import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../../client";
import {
  brandAttributeValues,
  brandAttributes,
  productVariantAttributes,
  productVariants,
  products,
} from "../../schema";
import type {
  ExplicitVariantInput,
  MatrixDimension,
  ReplaceVariantsResult,
  VariantAttributeAssignment,
  VariantWithAttributeAssignments,
} from "./types";
import { generateGloballyUniqueUpids } from "./upid-generation";

// =============================================================================
// CONSTRAINTS
// =============================================================================

/** Maximum number of attribute dimensions per product */
const MAX_DIMENSIONS = 3;

/** Maximum number of values per dimension */
const MAX_VALUES_PER_DIMENSION = 50;

/** Maximum total variants that can be created in one operation */
const MAX_TOTAL_VARIANTS = 500;

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validates that all attribute value IDs belong to the same brand as the product.
 * Returns the set of valid attribute value IDs or throws if any are invalid.
 */
async function validateBrandConsistency(
  db: Database,
  brandId: string,
  attributeValueIds: string[],
): Promise<void> {
  if (attributeValueIds.length === 0) return;

  const uniqueIds = [...new Set(attributeValueIds)];
  const rows = await db
    .select({ id: brandAttributeValues.id })
    .from(brandAttributeValues)
    .where(
      and(
        inArray(brandAttributeValues.id, uniqueIds),
        eq(brandAttributeValues.brandId, brandId),
      ),
    );

  const foundIds = new Set(rows.map((r) => r.id));
  const missingIds = uniqueIds.filter((id) => !foundIds.has(id));

  if (missingIds.length > 0) {
    throw new Error(
      `Attribute values not found or do not belong to brand: ${missingIds.join(", ")}`,
    );
  }
}

/**
 * Validates that a variant has at most one value per attribute.
 * Returns the attribute ID for each value or throws if duplicates found.
 */
async function validateOneValuePerAttribute(
  db: Database,
  attributeValueIds: string[],
): Promise<Map<string, string>> {
  if (attributeValueIds.length === 0) return new Map();

  const rows = await db
    .select({
      id: brandAttributeValues.id,
      attributeId: brandAttributeValues.attributeId,
    })
    .from(brandAttributeValues)
    .where(inArray(brandAttributeValues.id, attributeValueIds));

  const valueToAttribute = new Map<string, string>();
  const seenAttributes = new Map<string, string>(); // attributeId -> first valueId

  for (const row of rows) {
    valueToAttribute.set(row.id, row.attributeId);
    const existingValueId = seenAttributes.get(row.attributeId);
    if (existingValueId) {
      throw new Error(
        `Multiple values from same attribute not allowed: values ${existingValueId} and ${row.id} belong to attribute ${row.attributeId}`,
      );
    }
    seenAttributes.set(row.attributeId, row.id);
  }

  return valueToAttribute;
}

/**
 * Loads a mapping of attribute value ID -> attribute ID.
 *
 * Unlike `validateOneValuePerAttribute`, this does NOT enforce uniqueness of
 * attribute IDs. This is required for matrix mode where a single dimension
 * intentionally contains multiple values for the same attribute (e.g. Color:
 * Red, Blue, Green).
 */
async function loadValueToAttributeMap(
  db: Database,
  attributeValueIds: string[],
): Promise<Map<string, string>> {
  if (attributeValueIds.length === 0) return new Map();

  const uniqueIds = [...new Set(attributeValueIds)];
  const rows = await db
    .select({
      id: brandAttributeValues.id,
      attributeId: brandAttributeValues.attributeId,
    })
    .from(brandAttributeValues)
    .where(inArray(brandAttributeValues.id, uniqueIds));

  const valueToAttribute = new Map<string, string>();
  for (const row of rows) {
    valueToAttribute.set(row.id, row.attributeId);
  }

  // Defensive: callers typically run validateBrandConsistency first, but make
  // sure the mapping is complete to avoid confusing downstream errors.
  if (valueToAttribute.size !== uniqueIds.length) {
    const missing = uniqueIds.filter((id) => !valueToAttribute.has(id));
    throw new Error(`Attribute values not found: ${missing.join(", ")}`);
  }

  return valueToAttribute;
}

/**
 * Validates dimension constraints for matrix mode.
 */
function validateMatrixConstraints(dimensions: MatrixDimension[]): void {
  if (dimensions.length > MAX_DIMENSIONS) {
    throw new Error(
      `Too many dimensions: ${dimensions.length} exceeds maximum of ${MAX_DIMENSIONS}`,
    );
  }

  for (const dim of dimensions) {
    if (dim.valueIds.length > MAX_VALUES_PER_DIMENSION) {
      throw new Error(
        `Too many values for attribute ${dim.attributeId}: ${dim.valueIds.length} exceeds maximum of ${MAX_VALUES_PER_DIMENSION}`,
      );
    }
    if (dim.valueIds.length === 0) {
      throw new Error(
        `Dimension for attribute ${dim.attributeId} has no values`,
      );
    }
  }

  // Calculate total variants
  const totalVariants = dimensions.reduce(
    (acc, dim) => acc * dim.valueIds.length,
    1,
  );
  if (totalVariants > MAX_TOTAL_VARIANTS) {
    throw new Error(
      `Too many variants: ${totalVariants} exceeds maximum of ${MAX_TOTAL_VARIANTS}`,
    );
  }
}

// =============================================================================
// READ OPERATIONS
// =============================================================================

/**
 * Loads attribute assignments for multiple variants.
 * Returns a map of variant ID to array of attribute assignments.
 */
export async function loadVariantAttributesForVariants(
  db: Database,
  variantIds: string[],
): Promise<Map<string, VariantAttributeAssignment[]>> {
  if (variantIds.length === 0) return new Map();

  const rows = await db
    .select({
      variantId: productVariantAttributes.variantId,
      attributeValueId: productVariantAttributes.attributeValueId,
      sortOrder: productVariantAttributes.sortOrder,
      attributeId: brandAttributeValues.attributeId,
      attributeName: brandAttributes.name,
      valueName: brandAttributeValues.name,
    })
    .from(productVariantAttributes)
    .innerJoin(
      brandAttributeValues,
      eq(productVariantAttributes.attributeValueId, brandAttributeValues.id),
    )
    .innerJoin(
      brandAttributes,
      eq(brandAttributeValues.attributeId, brandAttributes.id),
    )
    .where(inArray(productVariantAttributes.variantId, variantIds))
    .orderBy(productVariantAttributes.sortOrder);

  const result = new Map<string, VariantAttributeAssignment[]>();

  for (const row of rows) {
    const assignments = result.get(row.variantId) ?? [];
    assignments.push({
      attributeValueId: row.attributeValueId,
      attributeId: row.attributeId,
      attributeName: row.attributeName,
      valueName: row.valueName,
      sortOrder: row.sortOrder,
    });
    result.set(row.variantId, assignments);
  }

  return result;
}

// =============================================================================
// WRITE OPERATIONS
// =============================================================================

/**
 * Replaces all attribute assignments for a single variant.
 * Deletes existing assignments and inserts new ones.
 */
export async function replaceVariantAttributes(
  db: Database,
  variantId: string,
  orderedAttributeValueIds: string[],
): Promise<void> {
  await db.transaction(async (tx) => {
    // Delete existing assignments
    await tx
      .delete(productVariantAttributes)
      .where(eq(productVariantAttributes.variantId, variantId));

    // Insert new assignments
    if (orderedAttributeValueIds.length > 0) {
      await tx.insert(productVariantAttributes).values(
        orderedAttributeValueIds.map((valueId, index) => ({
          variantId,
          attributeValueId: valueId,
          sortOrder: index,
        })),
      );
    }
  });
}

/**
 * Replaces all variants for a product using explicit variant definitions.
 * Each variant includes optional identifiers and attribute value assignments.
 *
 * - Variants can have zero attributes (for integration cases)
 * - Validates brand consistency and one-value-per-attribute constraint
 * - Generates UPIDs for new variants
 */
export async function replaceProductVariantsExplicit(
  db: Database,
  brandId: string,
  productId: string,
  variants: ExplicitVariantInput[],
): Promise<ReplaceVariantsResult> {
  // Validate product belongs to brand
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.brandId, brandId)))
    .limit(1);

  if (!product) {
    throw new Error("Product not found or does not belong to brand");
  }

  // Validate total variants
  if (variants.length > MAX_TOTAL_VARIANTS) {
    throw new Error(
      `Too many variants: ${variants.length} exceeds maximum of ${MAX_TOTAL_VARIANTS}`,
    );
  }

  // Collect all attribute value IDs for validation
  const allAttributeValueIds = variants.flatMap(
    (v) => v.attributeValueIds ?? [],
  );

  // Validate brand consistency
  await validateBrandConsistency(db, brandId, allAttributeValueIds);

  // Validate one value per attribute for each variant
  for (const variant of variants) {
    if (variant.attributeValueIds && variant.attributeValueIds.length > 0) {
      await validateOneValuePerAttribute(db, variant.attributeValueIds);
    }
  }

  // Generate UPIDs for variants that need them
  // Uses centralized function that checks both product_variants AND product_passports
  const variantsNeedingUpids = variants.filter((v) => !v.upid);
  const upids =
    variantsNeedingUpids.length > 0
      ? await generateGloballyUniqueUpids(db, variantsNeedingUpids.length)
      : [];

  let upidIndex = 0;

  // Execute in transaction
  const createdVariants = await db.transaction(async (tx) => {
    // Delete existing variants (cascades to product_variant_attributes)
    await tx
      .delete(productVariants)
      .where(eq(productVariants.productId, productId));

    if (variants.length === 0) {
      return [];
    }

    // Insert new variants
    const variantValues = variants.map((v) => ({
      productId,
      sku: v.sku ?? null,
      barcode: v.barcode ?? null,
      upid: v.upid ?? upids[upidIndex++]!,
    }));

    const insertedVariants = await tx
      .insert(productVariants)
      .values(variantValues)
      .returning({
        id: productVariants.id,
        sku: productVariants.sku,
        barcode: productVariants.barcode,
        upid: productVariants.upid,
      });

    // Insert attribute assignments
    const attributeAssignments: {
      variantId: string;
      attributeValueId: string;
      sortOrder: number;
    }[] = [];

    for (let i = 0; i < insertedVariants.length; i++) {
      const variant = insertedVariants[i]!;
      const inputVariant = variants[i]!;

      if (
        inputVariant.attributeValueIds &&
        inputVariant.attributeValueIds.length > 0
      ) {
        for (
          let sortOrder = 0;
          sortOrder < inputVariant.attributeValueIds.length;
          sortOrder++
        ) {
          attributeAssignments.push({
            variantId: variant.id,
            attributeValueId: inputVariant.attributeValueIds[sortOrder]!,
            sortOrder,
          });
        }
      }
    }

    if (attributeAssignments.length > 0) {
      await tx.insert(productVariantAttributes).values(attributeAssignments);
    }

    return insertedVariants.map((v, i) => ({
      id: v.id,
      sku: v.sku,
      barcode: v.barcode,
      upid: v.upid,
      attributeValueIds: variants[i]!.attributeValueIds ?? [],
    }));
  });

  return {
    created: createdVariants.length,
    variants: createdVariants,
  };
}

/**
 * Replaces all variants for a product using matrix (cartesian product) generation.
 * Generates all combinations of the provided dimensions.
 *
 * Example:
 *   dimensions: [
 *     { attributeId: "color-attr", valueIds: ["red", "blue"] },
 *     { attributeId: "size-attr", valueIds: ["S", "M", "L"] }
 *   ]
 *   Generates: red-S, red-M, red-L, blue-S, blue-M, blue-L (6 variants)
 *
 * @param variantMetadata Optional metadata keyed by combination string (e.g., "red|S")
 */
export async function replaceProductVariantsMatrix(
  db: Database,
  brandId: string,
  productId: string,
  dimensions: MatrixDimension[],
  variantMetadata?: Map<string, { sku?: string; barcode?: string }>,
): Promise<ReplaceVariantsResult> {
  // Handle empty dimensions - just delete all variants
  if (dimensions.length === 0) {
    return replaceProductVariantsExplicit(db, brandId, productId, []);
  }

  // Validate constraints
  validateMatrixConstraints(dimensions);

  // Validate product belongs to brand
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.brandId, brandId)))
    .limit(1);

  if (!product) {
    throw new Error("Product not found or does not belong to brand");
  }

  // Collect all attribute value IDs for validation
  const allAttributeValueIds = dimensions.flatMap((d) => d.valueIds);

  // Validate brand consistency
  await validateBrandConsistency(db, brandId, allAttributeValueIds);

  // Validate dimensions are distinct by attribute (a variant can't have two
  // values from the same attribute in matrix mode).
  const seenDimensionAttributes = new Set<string>();
  for (const dim of dimensions) {
    if (seenDimensionAttributes.has(dim.attributeId)) {
      throw new Error(`Duplicate dimension for attribute ${dim.attributeId}`);
    }
    seenDimensionAttributes.add(dim.attributeId);
  }

  // Validate that values belong to their declared attributes.
  // IMPORTANT: matrix mode intentionally has multiple values per attribute
  // across the full set, so we must NOT use validateOneValuePerAttribute here.
  const valueToAttribute = await loadValueToAttributeMap(
    db,
    allAttributeValueIds,
  );

  for (const dim of dimensions) {
    // Defensive: ensure no duplicates inside a single dimension.
    if (new Set(dim.valueIds).size !== dim.valueIds.length) {
      throw new Error(
        `Duplicate value IDs in dimension for attribute ${dim.attributeId}`,
      );
    }
    for (const valueId of dim.valueIds) {
      const actualAttributeId = valueToAttribute.get(valueId);
      if (actualAttributeId !== dim.attributeId) {
        throw new Error(
          `Value ${valueId} does not belong to attribute ${dim.attributeId} (belongs to ${actualAttributeId})`,
        );
      }
    }
  }

  // Generate cartesian product
  const combinations = generateCartesianProduct(dimensions);

  // Convert to explicit variants
  const explicitVariants: ExplicitVariantInput[] = combinations.map((combo) => {
    const key = combo.join("|");
    const metadata = variantMetadata?.get(key);
    return {
      attributeValueIds: combo,
      sku: metadata?.sku,
      barcode: metadata?.barcode,
    };
  });

  return replaceProductVariantsExplicit(
    db,
    brandId,
    productId,
    explicitVariants,
  );
}

/**
 * Generates cartesian product of dimension values.
 * Maintains dimension order in results.
 */
function generateCartesianProduct(dimensions: MatrixDimension[]): string[][] {
  if (dimensions.length === 0) return [[]];

  const [first, ...rest] = dimensions;
  const restProduct = generateCartesianProduct(rest);

  const result: string[][] = [];
  for (const valueId of first!.valueIds) {
    for (const restCombo of restProduct) {
      result.push([valueId, ...restCombo]);
    }
  }

  return result;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Gets variants for a product with their attribute assignments.
 */
export async function getProductVariantsWithAttributes(
  db: Database,
  brandId: string,
  productId: string,
): Promise<VariantWithAttributeAssignments[]> {
  // Validate product belongs to brand
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.brandId, brandId)))
    .limit(1);

  if (!product) {
    return [];
  }

  // Get variants
  const variantRows = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      sku: productVariants.sku,
      barcode: productVariants.barcode,
      upid: productVariants.upid,
      createdAt: productVariants.createdAt,
      updatedAt: productVariants.updatedAt,
    })
    .from(productVariants)
    .where(eq(productVariants.productId, productId));

  if (variantRows.length === 0) {
    return [];
  }

  // Load attributes for all variants
  const variantIds = variantRows.map((v) => v.id);
  const attributeMap = await loadVariantAttributesForVariants(db, variantIds);

  return variantRows.map((v) => ({
    id: v.id,
    productId: v.productId,
    sku: v.sku,
    barcode: v.barcode,
    upid: v.upid,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    attributes: attributeMap.get(v.id) ?? [],
  }));
}
