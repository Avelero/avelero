/**
 * Integration Sync Engine
 *
 * Core sync logic for processing data from external systems.
 * Handles variant-level syncing with automatic product creation.
 *
 * Sync Flow:
 * 1. Fetch variants from external system (via connector)
 * 2. For each variant:
 *    a. Extract values using field mappings
 *    b. Find/create reference entities (colors, sizes, tags)
 *    c. Find/create parent product
 *    d. Find/create or update variant
 *    e. Update variant link
 *
 * @see plan-integration.md Section 6.4 for architecture details
 */

import { createHash } from "node:crypto";
import type { Database } from "@v1/db/client";
import { and, eq, or } from "@v1/db/index";
import {
  createBrandTag,
  createColor,
  createSize,
  createVariantLink,
  findColorByName,
  findSizeByName,
  findTagByName,
  findVariantLink,
  updateVariantLink,
} from "@v1/db/queries";
import { productVariants, products } from "@v1/db/schema";
import { generateUniqueUpid } from "@v1/db/utils";
import type {
  ConnectorFieldDefinition,
  ConnectorSchema,
} from "./connectors/types";
import { getConnector } from "./registry";
import type {
  ExtractedValues,
  FetchedVariant,
  FieldConfig,
  SyncContext,
  SyncResult,
} from "./types";

// =============================================================================
// TYPES
// =============================================================================

interface EffectiveFieldMapping {
  fieldKey: string;
  definition: ConnectorFieldDefinition;
  sourceKey: string;
}

interface ProcessedVariantResult {
  success: boolean;
  variantCreated: boolean;
  variantUpdated: boolean;
  productCreated: boolean;
  productUpdated: boolean;
  entitiesCreated: number;
  error?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Build effective field mappings from schema and configs.
 * Only includes fields that are enabled for this integration.
 */
function buildEffectiveFieldMappings(
  schema: ConnectorSchema,
  fieldConfigs: FieldConfig[],
): EffectiveFieldMapping[] {
  const mappings: EffectiveFieldMapping[] = [];
  const configMap = new Map(
    fieldConfigs
      .filter((c) => c.isEnabled)
      .map((c) => [c.fieldKey, c.selectedSource]),
  );

  for (const [fieldKey, definition] of Object.entries(schema.fields)) {
    // If there's a config, use it; otherwise use default
    const isEnabled = configMap.has(fieldKey) || !fieldConfigs.length;
    if (!isEnabled) continue;

    const sourceKey = configMap.get(fieldKey) ?? definition.defaultSource;

    mappings.push({
      fieldKey,
      definition,
      sourceKey,
    });
  }

  return mappings;
}

/**
 * Get a value from a nested object using dot notation path.
 */
function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Extract values from external data using field mappings.
 */
function extractValues(
  externalData: Record<string, unknown>,
  mappings: EffectiveFieldMapping[],
): ExtractedValues {
  const result: ExtractedValues = {
    product: {},
    variant: {},
    referenceEntities: {},
    relations: {},
  };

  for (const mapping of mappings) {
    const { fieldKey, definition, sourceKey } = mapping;

    // Find the source option
    const sourceOption = definition.sourceOptions.find(
      (opt) => opt.key === sourceKey,
    );
    if (!sourceOption) continue;

    // Get raw value
    let value = getValueByPath(externalData, sourceOption.path);

    // Apply source-specific transform
    if (sourceOption.transform && value !== undefined) {
      value = sourceOption.transform(value);
    }

    // Apply global transform
    if (definition.transform && value !== undefined) {
      value = definition.transform(value);
    }

    // Skip null/undefined values
    if (value === null || value === undefined) continue;

    // Parse field key safely
    const dotIndex = fieldKey.indexOf(".");
    if (dotIndex === -1) continue;

    const entityType = fieldKey.slice(0, dotIndex);
    const fieldName = fieldKey.slice(dotIndex + 1);

    // Handle reference entities (can be on product or variant level)
    if (definition.referenceEntity) {
      if (definition.referenceEntity === "color") {
        result.referenceEntities.colorName = String(value);
      } else if (definition.referenceEntity === "size") {
        result.referenceEntities.sizeName = String(value);
      } else if (definition.referenceEntity === "category") {
        // Store category name for potential future lookup
        // Categories are system-level, so we skip them for now
        result.referenceEntities.categoryName = String(value);
      }
      // Don't put reference entity values directly in product/variant objects
      continue;
    }

    if (entityType === "product") {
      result.product[fieldName] = value;
    } else if (entityType === "variant") {
      result.variant[fieldName] = value;
    }

    // Handle relations (tags)
    if (definition.isRelation && definition.relationType === "tags") {
      result.relations.tags = value as string[];
    }
  }

  return result;
}

/**
 * Compute a hash of extracted values for change detection.
 */
function computeHash(values: ExtractedValues): string {
  const str = JSON.stringify(values);
  return createHash("sha256").update(str).digest("hex").slice(0, 32);
}

/**
 * Find a variant by any of its identifiers.
 */
async function findVariantByIdentifiers(
  db: Database,
  productId: string,
  identifiers: {
    sku?: string;
    ean?: string;
    gtin?: string;
    barcode?: string;
  },
): Promise<{ id: string } | null> {
  // Build conditions array with type-safe comparisons
  const identifierConditions = [];

  if (identifiers.sku) {
    identifierConditions.push(eq(productVariants.sku, identifiers.sku));
  }
  if (identifiers.ean) {
    identifierConditions.push(eq(productVariants.ean, identifiers.ean));
  }
  if (identifiers.gtin) {
    identifierConditions.push(eq(productVariants.gtin, identifiers.gtin));
  }
  if (identifiers.barcode) {
    identifierConditions.push(eq(productVariants.barcode, identifiers.barcode));
  }

  if (identifierConditions.length === 0) return null;

  // Use raw SQL for the query to avoid type issues
  const rows = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.productId, productId),
        or(...identifierConditions),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Find or create a color by name.
 */
async function findOrCreateColor(
  db: Database,
  brandId: string,
  name: string,
): Promise<{ id: string; created: boolean }> {
  const existing = await findColorByName(db, brandId, name);
  if (existing) {
    return { id: existing.id, created: false };
  }

  // Create with a default hex color
  const created = await createColor(db, brandId, { name, hex: "#808080" });
  if (!created) {
    throw new Error(`Failed to create color: ${name}`);
  }
  return { id: created.id, created: true };
}

/**
 * Find or create a size by name.
 */
async function findOrCreateSize(
  db: Database,
  brandId: string,
  name: string,
): Promise<{ id: string; created: boolean }> {
  const existing = await findSizeByName(db, brandId, name);
  if (existing) {
    return { id: existing.id, created: false };
  }

  const created = await createSize(db, brandId, { name });
  if (!created) {
    throw new Error(`Failed to create size: ${name}`);
  }
  return { id: created.id, created: true };
}

/**
 * Find or create a tag by name.
 */
async function findOrCreateTag(
  db: Database,
  brandId: string,
  name: string,
): Promise<{ id: string; created: boolean }> {
  const existing = await findTagByName(db, brandId, name);
  if (existing) {
    return { id: existing.id, created: false };
  }

  const created = await createBrandTag(db, brandId, { name });
  if (!created) {
    throw new Error(`Failed to create tag: ${name}`);
  }
  return { id: created.id, created: true };
}

/**
 * Find or create a product by handle.
 */
async function findOrCreateProduct(
  db: Database,
  brandId: string,
  productHandle: string,
  productData: ExtractedValues["product"],
): Promise<{ id: string; created: boolean }> {
  // Try to find existing product by handle
  const existingRows = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.brandId, brandId),
        eq(products.productHandle, productHandle),
      ),
    )
    .limit(1);

  const existing = existingRows[0];
  if (existing) {
    return { id: existing.id, created: false };
  }

  // Create new product
  // Note: categoryId is not set during sync - categories are system-level
  // and require manual mapping. Can be enhanced later with category lookup.
  const insertedRows = await db
    .insert(products)
    .values({
      brandId,
      name: (productData.name as string) || productHandle,
      productHandle,
      description: (productData.description as string) ?? null,
      primaryImagePath: (productData.primaryImagePath as string) ?? null,
      status: "unpublished", // New products start unpublished
    })
    .returning({ id: products.id });

  const created = insertedRows[0];
  if (!created) {
    throw new Error(`Failed to create product: ${productHandle}`);
  }

  return { id: created.id, created: true };
}

/**
 * Process a single variant from external data.
 */
async function processVariant(
  db: Database,
  ctx: SyncContext,
  externalVariant: FetchedVariant,
  mappings: EffectiveFieldMapping[],
): Promise<ProcessedVariantResult> {
  let entitiesCreated = 0;
  let variantCreated = false;
  let variantUpdated = false;
  let productCreated = false;
  let productUpdated = false;

  try {
    // Extract values using field mappings
    const extracted = extractValues(externalVariant.data, mappings);
    const hash = computeHash(extracted);

    // Check for existing variant link
    const existingLink = await findVariantLink(
      db,
      ctx.brandIntegrationId,
      externalVariant.externalId,
    );

    // If link exists and hash unchanged, skip
    if (existingLink?.lastSyncedHash === hash) {
      return {
        success: true,
        variantCreated: false,
        variantUpdated: false,
        productCreated: false,
        productUpdated: false,
        entitiesCreated: 0,
      };
    }

    // Handle reference entities
    let colorId: string | null = null;
    let sizeId: string | null = null;

    if (extracted.referenceEntities.colorName) {
      const color = await findOrCreateColor(
        db,
        ctx.brandId,
        extracted.referenceEntities.colorName,
      );
      colorId = color.id;
      if (color.created) entitiesCreated++;
    }

    if (extracted.referenceEntities.sizeName) {
      const size = await findOrCreateSize(
        db,
        ctx.brandId,
        extracted.referenceEntities.sizeName,
      );
      sizeId = size.id;
      if (size.created) entitiesCreated++;
    }

    // Find or create product
    const productHandle =
      (extracted.product.productHandle as string) ||
      `shopify-${externalVariant.externalProductId.replace(/[^a-z0-9]/gi, "-")}`;

    const product = await findOrCreateProduct(
      db,
      ctx.brandId,
      productHandle,
      extracted.product,
    );
    productCreated = product.created;

    // Update product if it already existed
    if (!product.created) {
      const updateData: Record<string, unknown> = {};

      if (extracted.product.name) {
        updateData.name = extracted.product.name;
      }
      if (extracted.product.description !== undefined) {
        updateData.description = extracted.product.description;
      }
      if (extracted.product.primaryImagePath !== undefined) {
        updateData.primaryImagePath = extracted.product.primaryImagePath;
      }
      if (extracted.product.webshopUrl !== undefined) {
        updateData.webshopUrl = extracted.product.webshopUrl;
      }
      if (extracted.product.salesStatus !== undefined) {
        updateData.salesStatus = extracted.product.salesStatus;
      }

      if (Object.keys(updateData).length > 0) {
        await db
          .update(products)
          .set(updateData)
          .where(eq(products.id, product.id));
        productUpdated = true;
      }
    }

    // Find or create variant
    let variantId: string | null = null;

    if (existingLink) {
      // Update existing variant
      variantId = existingLink.variantId;

      const variantUpdateData: Record<string, unknown> = {
        sku: (extracted.variant.sku as string) ?? null,
        ean: (extracted.variant.ean as string) ?? null,
        gtin: (extracted.variant.gtin as string) ?? null,
        barcode: (extracted.variant.barcode as string) ?? null,
        colorId,
        sizeId,
      };

      await db
        .update(productVariants)
        .set(variantUpdateData)
        .where(eq(productVariants.id, variantId));

      variantUpdated = true;

      // Update link
      await updateVariantLink(db, existingLink.id, {
        externalSku: (extracted.variant.sku as string) ?? null,
        externalBarcode: (extracted.variant.barcode as string) ?? null,
        lastSyncedHash: hash,
      });
    } else {
      // Try to find existing variant by identifiers
      const existingVariant = await findVariantByIdentifiers(db, product.id, {
        sku: extracted.variant.sku as string | undefined,
        ean: extracted.variant.ean as string | undefined,
        gtin: extracted.variant.gtin as string | undefined,
        barcode: extracted.variant.barcode as string | undefined,
      });

      if (existingVariant) {
        // Update existing variant found by identifiers
        variantId = existingVariant.id;

        const variantUpdateData: Record<string, unknown> = {
          sku: (extracted.variant.sku as string) ?? null,
          ean: (extracted.variant.ean as string) ?? null,
          gtin: (extracted.variant.gtin as string) ?? null,
          barcode: (extracted.variant.barcode as string) ?? null,
          colorId,
          sizeId,
        };

        await db
          .update(productVariants)
          .set(variantUpdateData)
          .where(eq(productVariants.id, variantId));

        variantUpdated = true;
      } else {
        // Create new variant
        const variantUpid = await generateUniqueUpid({
          isTaken: async (candidate) => {
            const rows = await db
              .select({ id: productVariants.id })
              .from(productVariants)
              .where(eq(productVariants.upid, candidate))
              .limit(1);
            return Boolean(rows[0]);
          },
        });

        const insertedRows = await db
          .insert(productVariants)
          .values({
            productId: product.id,
            sku: (extracted.variant.sku as string) ?? null,
            ean: (extracted.variant.ean as string) ?? null,
            gtin: (extracted.variant.gtin as string) ?? null,
            barcode: (extracted.variant.barcode as string) ?? null,
            colorId,
            sizeId,
            upid: variantUpid,
          })
          .returning({ id: productVariants.id });

        const created = insertedRows[0];
        if (!created) {
          throw new Error("Failed to create variant");
        }

        variantId = created.id;
        variantCreated = true;
      }

      // Create variant link
      await createVariantLink(db, {
        brandIntegrationId: ctx.brandIntegrationId,
        variantId,
        externalId: externalVariant.externalId,
        externalProductId: externalVariant.externalProductId,
        externalSku: (extracted.variant.sku as string) ?? null,
        externalBarcode: (extracted.variant.barcode as string) ?? null,
        lastSyncedHash: hash,
      });
    }

    // Handle tags (if present)
    // TODO: Implement tag syncing via junction table

    return {
      success: true,
      variantCreated,
      variantUpdated,
      productCreated,
      productUpdated,
      entitiesCreated,
    };
  } catch (error) {
    return {
      success: false,
      variantCreated: false,
      variantUpdated: false,
      productCreated: false,
      productUpdated: false,
      entitiesCreated: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Sync variants from an external system.
 *
 * @param ctx - Sync context with credentials and configuration
 * @returns Sync result with stats and errors
 */
export async function syncVariants(ctx: SyncContext): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    variantsProcessed: 0,
    variantsCreated: 0,
    variantsUpdated: 0,
    variantsSkipped: 0,
    variantsFailed: 0,
    productsCreated: 0,
    productsUpdated: 0,
    entitiesCreated: 0,
    errors: [],
  };

  try {
    // Get connector
    const connector = getConnector(ctx.integrationSlug);
    if (!connector) {
      throw new Error(`Unknown integration: ${ctx.integrationSlug}`);
    }

    // Build field mappings
    const mappings = buildEffectiveFieldMappings(
      connector.schema,
      ctx.fieldConfigs,
    );

    // Fetch and process variants
    const db = ctx.db as Database;
    const variantGenerator = connector.fetchVariants(ctx.credentials);

    for await (const batch of variantGenerator) {
      for (const variant of batch) {
        result.variantsProcessed++;

        const processed = await processVariant(db, ctx, variant, mappings);

        if (processed.success) {
          if (processed.variantCreated) {
            result.variantsCreated++;
          } else if (processed.variantUpdated) {
            result.variantsUpdated++;
          } else {
            result.variantsSkipped++;
          }

          if (processed.productCreated) {
            result.productsCreated++;
          } else if (processed.productUpdated) {
            result.productsUpdated++;
          }

          result.entitiesCreated += processed.entitiesCreated;
        } else {
          result.variantsFailed++;
          result.errors.push({
            externalId: variant.externalId,
            message: processed.error || "Unknown error",
          });
        }
      }
    }

    result.success = result.variantsFailed === 0;
  } catch (error) {
    result.errors.push({
      externalId: "SYSTEM",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return result;
}

/**
 * Test a connection to an external system.
 *
 * @param integrationSlug - The integration type (e.g., "shopify")
 * @param credentials - The decrypted credentials
 * @returns Connection test result
 */
export async function testIntegrationConnection(
  integrationSlug: string,
  credentials: SyncContext["credentials"],
): Promise<{ success: boolean; message: string; data?: unknown }> {
  const connector = getConnector(integrationSlug);
  if (!connector) {
    return {
      success: false,
      message: `Unknown integration: ${integrationSlug}`,
    };
  }

  try {
    const result = await connector.testConnection(credentials);
    return { success: true, message: "Connection successful", data: result };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
