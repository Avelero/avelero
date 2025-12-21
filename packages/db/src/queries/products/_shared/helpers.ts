/**
 * Shared helper functions for product queries.
 * 
 * Contains mapping, loading, and validation utilities used across
 * multiple product query modules.
 */

import { and, asc, eq, inArray } from "drizzle-orm";
import type { Database } from "../../../client";
import {
  brandAttributes,
  brandAttributeValues,
  brandEcoClaims,
  brandFacilities,
  brandMaterials,
  brandSeasons,
  brandTags,
  taxonomyCategories,
  productEcoClaims,
  productEnvironment,
  productJourneySteps,
  productMaterials,
  productVariantAttributes,
  productVariants,
  products,
  productTags,
} from "../../../schema";
import type {
  ProductAttributesBundle,
  ProductRecord,
  ProductVariantWithAttributes,
  VariantAttributeSummary,
} from "../types.js";

/**
 * Maps database row to ProductRecord, handling selective field queries.
 *
 * Only includes fields that were actually selected in the query, allowing
 * for efficient partial queries when full product data isn't needed.
 */
export function mapProductRow(row: Record<string, unknown>): ProductRecord {
  const product: ProductRecord = {
    id: String(row.id),
  };

  if ("name" in row) product.name = (row.name as string | null) ?? null;
  if ("description" in row)
    product.description = (row.description as string | null) ?? null;
  if ("category_id" in row)
    product.category_id = (row.category_id as string | null) ?? null;
  if ("season_id" in row)
    product.season_id = (row.season_id as string | null) ?? null;
  if ("manufacturer_id" in row)
    product.manufacturer_id =
      (row.manufacturer_id as string | null) ?? null;
  if ("product_handle" in row)
    product.product_handle =
      (row.product_handle as string | null) ?? null;
  if ("upid" in row) product.upid = (row.upid as string | null) ?? null;
  if ("status" in row) product.status = (row.status as string | null) ?? null;
  if ("image_path" in row)
    product.image_path =
      (row.image_path as string | null) ?? null;
  if ("created_at" in row)
    product.created_at = (row.created_at as string | null) ?? undefined;
  if ("updated_at" in row)
    product.updated_at = (row.updated_at as string | null) ?? undefined;
  if ("category_name" in row)
    product.category_name = (row.category_name as string | null) ?? null;
  if ("category_path" in row)
    product.category_path = (row.category_path as string[] | null) ?? null;
  if ("season_name" in row)
    product.season_name = (row.season_name as string | null) ?? null;

  return product;
}

/**
 * Creates an empty product attributes bundle.
 *
 * Used as default when attributes are not requested or don't exist.
 */
export function createEmptyAttributes(): ProductAttributesBundle {
  return {
    materials: [],
    ecoClaims: [],
    environment: null,
    journey: [],
    tags: [],
  };
}

/**
 * Validates that a product belongs to a specific brand.
 *
 * Security check to prevent cross-brand product access. Throws an error
 * if the product doesn't exist or belongs to a different brand.
 */
export async function ensureProductBelongsToBrand(
  db: Database,
  brandId: string,
  productId: string,
): Promise<{ id: string }> {
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.brandId, brandId)))
    .limit(1);
  const product = rows[0];
  if (!product) {
    throw new Error("Product does not belong to the specified brand");
  }
  return product;
}

/**
 * Batch loads variants with attributes for multiple products.
 *
 * Performs database queries to fetch all variants and their attributes for
 * the given product IDs, then groups them by product ID for efficient lookups.
 * Optimizes N+1 query problems when loading product lists.
 */
export async function loadVariantsForProducts(
  db: Database,
  productIds: readonly string[],
): Promise<Map<string, ProductVariantWithAttributes[]>> {
  const map = new Map<string, ProductVariantWithAttributes[]>();
  if (productIds.length === 0) return map;

  // Load variants
  const variantRows = await db
    .select({
      id: productVariants.id,
      product_id: productVariants.productId,
      sku: productVariants.sku,
      barcode: productVariants.barcode,
      upid: productVariants.upid,
      created_at: productVariants.createdAt,
      updated_at: productVariants.updatedAt,
    })
    .from(productVariants)
    .where(inArray(productVariants.productId, [...productIds]))
    .orderBy(asc(productVariants.createdAt));

  if (variantRows.length === 0) return map;

  // Load attributes for all variants
  const variantIds = variantRows.map((v) => v.id);
  const attributeRows = await db
    .select({
      variant_id: productVariantAttributes.variantId,
      attribute_id: brandAttributeValues.attributeId,
      attribute_name: brandAttributes.name,
      value_id: brandAttributeValues.id,
      value_name: brandAttributeValues.name,
      sort_order: productVariantAttributes.sortOrder,
    })
    .from(productVariantAttributes)
    .innerJoin(
      brandAttributeValues,
      eq(productVariantAttributes.attributeValueId, brandAttributeValues.id)
    )
    .innerJoin(
      brandAttributes,
      eq(brandAttributeValues.attributeId, brandAttributes.id)
    )
    .where(inArray(productVariantAttributes.variantId, variantIds))
    .orderBy(asc(productVariantAttributes.sortOrder));

  // Group attributes by variant ID
  const attributesByVariant = new Map<string, VariantAttributeSummary[]>();
  for (const row of attributeRows) {
    const attrs = attributesByVariant.get(row.variant_id) ?? [];
    attrs.push({
      attribute_id: row.attribute_id,
      attribute_name: row.attribute_name,
      value_id: row.value_id,
      value_name: row.value_name,
    });
    attributesByVariant.set(row.variant_id, attrs);
  }

  // Build result map
  for (const row of variantRows) {
    const collection = map.get(row.product_id) ?? [];
    collection.push({
      id: row.id,
      product_id: row.product_id,
      sku: row.sku ?? null,
      barcode: row.barcode ?? null,
      upid: row.upid ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      attributes: attributesByVariant.get(row.id) ?? [],
    });
    map.set(row.product_id, collection);
  }

  return map;
}

/**
 * Batch loads attributes for multiple products.
 *
 * Performs efficient batch queries to fetch materials, eco-claims,
 * environment, journey steps, and tags for multiple products at once.
 * Optimizes N+1 query problems when loading product lists with attributes.
 */
export async function loadAttributesForProducts(
  db: Database,
  productIds: readonly string[],
): Promise<Map<string, ProductAttributesBundle>> {
  const map = new Map<string, ProductAttributesBundle>();
  if (productIds.length === 0) return map;

  const ensureBundle = (productId: string): ProductAttributesBundle => {
    if (!map.has(productId)) {
      map.set(productId, createEmptyAttributes());
    }
    return map.get(productId)!;
  };

  const materialRows = await db
    .select({
      id: productMaterials.id,
      product_id: productMaterials.productId,
      brand_material_id: productMaterials.brandMaterialId,
      percentage: productMaterials.percentage,
      material_name: brandMaterials.name,
    })
    .from(productMaterials)
    .leftJoin(
      brandMaterials,
      eq(brandMaterials.id, productMaterials.brandMaterialId),
    )
    .where(inArray(productMaterials.productId, [...productIds]))
    .orderBy(asc(productMaterials.createdAt));

  for (const row of materialRows) {
    const bundle = ensureBundle(row.product_id);
    bundle.materials.push({
      id: row.id,
      brand_material_id: row.brand_material_id,
      material_name: row.material_name ?? null,
      percentage: row.percentage ? String(row.percentage) : null,
    });
  }

  const ecoRows = await db
    .select({
      id: productEcoClaims.id,
      product_id: productEcoClaims.productId,
      eco_claim_id: productEcoClaims.ecoClaimId,
      claim: brandEcoClaims.claim,
    })
    .from(productEcoClaims)
    .leftJoin(
      brandEcoClaims,
      eq(brandEcoClaims.id, productEcoClaims.ecoClaimId),
    )
    .where(inArray(productEcoClaims.productId, [...productIds]))
    .orderBy(asc(productEcoClaims.createdAt));

  for (const row of ecoRows) {
    const bundle = ensureBundle(row.product_id);
    bundle.ecoClaims.push({
      id: row.id,
      eco_claim_id: row.eco_claim_id,
      claim: row.claim ?? null,
    });
  }

  const environmentRows = await db
    .select({
      product_id: productEnvironment.productId,
      value: productEnvironment.value,
      unit: productEnvironment.unit,
      metric: productEnvironment.metric,
    })
    .from(productEnvironment)
    .where(inArray(productEnvironment.productId, [...productIds]));

  for (const row of environmentRows) {
    const bundle = ensureBundle(row.product_id);
    if (!bundle.environment) {
      bundle.environment = {
        product_id: row.product_id,
        carbon_kg_co2e: null,
        water_liters: null,
      };
    }
    if (row.metric === "carbon_kg_co2e") {
      bundle.environment.carbon_kg_co2e = row.value ? String(row.value) : null;
    } else if (row.metric === "water_liters") {
      bundle.environment.water_liters = row.value ? String(row.value) : null;
    }
  }

  // Load journey steps with their facility (one facility per step)
  const journeyRows = await db
    .select({
      id: productJourneySteps.id,
      product_id: productJourneySteps.productId,
      sort_index: productJourneySteps.sortIndex,
      step_type: productJourneySteps.stepType,
      facility_id: productJourneySteps.facilityId,
      facility_name: brandFacilities.displayName,
    })
    .from(productJourneySteps)
    .leftJoin(
      brandFacilities,
      eq(brandFacilities.id, productJourneySteps.facilityId),
    )
    .where(inArray(productJourneySteps.productId, [...productIds]))
    .orderBy(asc(productJourneySteps.sortIndex));

  // Add journey steps to bundles
  for (const row of journeyRows) {
    const bundle = ensureBundle(row.product_id);
    bundle.journey.push({
      id: row.id,
      sort_index: row.sort_index,
      step_type: row.step_type,
      facility_id: row.facility_id,
      facility_name: row.facility_name ?? null,
    });
  }

  const tagRows = await db
    .select({
      id: productTags.id,
      product_id: productTags.productId,
      tag_id: productTags.tagId,
      name: brandTags.name,
      hex: brandTags.hex,
    })
    .from(productTags)
    .leftJoin(brandTags, eq(brandTags.id, productTags.tagId))
    .where(inArray(productTags.productId, [...productIds]));

  for (const row of tagRows) {
    const bundle = ensureBundle(row.product_id);
    bundle.tags.push({
      id: row.id,
      tag_id: row.tag_id,
      name: row.name ?? null,
      hex: row.hex ?? null,
    });
  }

  // Ensure every product id has a bundle even if empty
  for (const id of productIds) {
    ensureBundle(id);
  }

  return map;
}

/**
 * Batch loads category paths for multiple products.
 *
 * Performs a single database query to fetch all categories, then builds
 * hierarchical paths in memory for efficient lookups. Optimizes N+1 query
 * problems when loading product lists with category information.
 */
export async function loadCategoryPathsForProducts(
  db: Database,
  categoryIds: readonly (string | null)[],
): Promise<Map<string | null, string[]>> {
  const map = new Map<string | null, string[]>();
  const uniqueIds = Array.from(
    new Set(categoryIds.filter((id): id is string => id !== null)),
  );

  if (uniqueIds.length === 0) return map;

  // Load all categories in one query
  const allCategories = await db
    .select({
      id: taxonomyCategories.id,
      name: taxonomyCategories.name,
      parentId: taxonomyCategories.parentId,
    })
    .from(taxonomyCategories);

  // Build in-memory lookup map for O(1) access
  const categoryMap = new Map(
    allCategories.map((c) => [
      c.id,
      { name: c.name, parentId: c.parentId ?? null },
    ]),
  );

  // Build paths for each unique category ID by traversing parent chain
  function buildPath(categoryId: string): string[] {
    const path: string[] = [];
    let currentId: string | null = categoryId;

    while (currentId) {
      const category = categoryMap.get(currentId);
      if (!category) break;

      path.unshift(category.name); // Add to front of array
      currentId = category.parentId; // Move to parent
    }

    return path;
  }

  // Build paths for all unique category IDs
  for (const id of uniqueIds) {
    map.set(id, buildPath(id));
  }

  return map;
}







