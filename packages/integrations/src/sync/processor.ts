/**
 * Product Processor
 *
 * Processes a single product with all its variants.
 * Returns pending operations to be batched at the engine level.
 * 
 * Also includes value extraction logic (inlined from extractor.ts).
 * 
 * IMPORTANT: This module is now SYNCHRONOUS and does NO database queries.
 * All lookup data is pre-fetched by the engine and passed in.
 */

import { createHash, randomInt } from "node:crypto";
import type {
  ProductLinkData,
  VariantLinkData,
  PreFetchedVariant,
  GlobalVariantIndex,
} from "@v1/db/queries/integrations";
import { slugifyProductName } from "@v1/db/utils";
import type {
  ConnectorFieldDefinition,
  ConnectorSchema,
  ExtractedValues,
  FetchedProduct,
  FieldConfig,
  SourceOption,
  SyncContext,
} from "../types";
import { parseSelectedOptions } from "../connectors/shopify/schema";
import {
  type SyncCaches,
  getCachedTag,
  getCachedProduct,
  cacheProduct,
  markProductUpdated,
  isProductUpdated,
  getCachedAttributeId,
  getCachedAttributeValueId,
} from "./caches";

// =============================================================================
// VALUE EXTRACTION (inlined from extractor.ts)
// =============================================================================

export interface EffectiveFieldMapping {
  fieldKey: string;
  definition: ConnectorFieldDefinition;
  sourceKey: string;
}

/**
 * Get a value from a nested object using dot notation path.
 * Use "." as path to return the root object.
 */
export function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  // Special case: "." returns the root object
  if (path === ".") return obj;

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
 * Build effective field mappings from schema and configs.
 * Only includes fields that are enabled for this integration.
 */
export function buildEffectiveFieldMappings(
  schema: ConnectorSchema,
  fieldConfigs: FieldConfig[]
): EffectiveFieldMapping[] {
  const mappings: EffectiveFieldMapping[] = [];
  const configMap = new Map(
    fieldConfigs
      .filter((c) => c.isEnabled)
      .map((c) => [c.fieldKey, c.selectedSource])
  );

  for (const [fieldKey, definition] of Object.entries(schema.fields) as [string, ConnectorFieldDefinition][]) {
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
 * Extract values from external data using field mappings.
 */
export function extractValues(
  externalData: Record<string, unknown>,
  mappings: EffectiveFieldMapping[]
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
      (opt: SourceOption) => opt.key === sourceKey
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
      if (definition.referenceEntity === "category") {
        // Store category UUID directly (resolved from Shopify taxonomy mapping)
        result.referenceEntities.categoryId = String(value);
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
export function computeHash(values: ExtractedValues): string {
  const str = JSON.stringify(values);
  return createHash("sha256").update(str).digest("hex").slice(0, 32);
}

// =============================================================================
// ATTRIBUTE VALUE RESOLUTION
// =============================================================================

/**
 * Resolve variant attribute value IDs from selected options.
 * Uses caches to look up IDs without database queries.
 */
export function resolveAttributeValueIds(
  options: Array<{ name: string; value: string }>,
  caches: SyncCaches
): string[] {
  const valueIds: string[] = [];

  for (const opt of options) {
    const attrId = getCachedAttributeId(caches, opt.name);
    if (!attrId) continue;

    const valueId = getCachedAttributeValueId(caches, attrId, opt.value);
    if (valueId) {
      valueIds.push(valueId);
    }
  }

  return valueIds;
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * Data for creating a new product (batched at engine level).
 */
export interface ProductCreateOp {
  externalId: string;
  name: string;
  productHandle: string;
  description: string | null;
  categoryId: string | null;
  imageUrl: string | null;
}

/**
 * Update data for the `products` table.
 */
export interface ProductUpdateOp {
  id: string;
  name?: string;
  description?: string | null;
  categoryId?: string | null;
}

/**
 * Upsert data for the `product_commercial` table.
 */
export interface ProductCommercialOp {
  productId: string;
  webshopUrl?: string | null;
  price?: string | null;
  currency?: string | null;
  salesStatus?: string | null;
}

export interface PendingOperations {
  productCreates: ProductCreateOp[];
  productCreate?: ProductCreateOp;
  productUpdates: ProductUpdateOp[];
  productCommercialUpserts: ProductCommercialOp[];
  productLinkUpserts: Array<{
    brandIntegrationId: string;
    productId: string;
    externalId: string;
    externalName: string | null;
    lastSyncedHash: string | null;
    /** Whether this source product is canonical within its integration */
    isCanonical?: boolean;
  }>;
  tagAssignments: Array<{ productId: string; tagIds: string[] }>;
  variantUpdates: Array<{ id: string; sku?: string | null; barcode?: string | null }>;
  variantCreates: Array<{
    productId: string;
    sku: string | null;
    barcode: string | null;
    attributeValueIds: string[];
    linkData: {
      brandIntegrationId: string;
      externalId: string;
      externalProductId: string;
      externalSku: string | null;
      externalBarcode: string | null;
      lastSyncedHash: string;
    };
  }>;
  variantLinkUpserts: Array<{
    brandIntegrationId: string;
    variantId: string;
    externalId: string;
    externalProductId: string;
    externalSku: string | null;
    externalBarcode: string | null;
    lastSyncedHash: string | null;
  }>;
  variantAttributeAssignments: Array<{
    variantId: string;
    attributeValueIds: string[];
  }>;
  /** Variant display overrides for non-canonical source products (multi-source integration) */
  variantDisplayOverrides: Array<{
    variantId: string;
    name?: string | null;
    description?: string | null;
    imagePath?: string | null;
    sourceIntegration?: string | null;
    sourceExternalId?: string | null;
  }>;
}

export interface ProcessedProductResult {
  success: boolean;
  productCreated: boolean;
  productUpdated: boolean;
  variantsCreated: number;
  variantsUpdated: number;
  variantsSkipped: number;
  productId?: string;
  error?: string;
  pendingOps: Omit<PendingOperations, 'productCreates'> & { productCreate?: ProductCreateOp };
}

export interface PreFetchedData {
  productLinks: Map<string, ProductLinkData>;
  variantLinks: Map<string, VariantLinkData>;
  existingVariantsByProduct: Map<string, PreFetchedVariant[]>;
  /** Pre-computed identifier matches: externalId -> matched product */
  identifierMatches: Map<string, { productId: string; productHandle: string }>;
  /** Pre-computed set of handles that are already taken */
  takenHandles: Set<string>;
  /** Global variant index for SKU/barcode matching across ALL brand variants */
  globalVariantIndex: GlobalVariantIndex;
  /**
   * Set of Avelero product IDs that already have a canonical link from this integration.
   * Used to determine if a new link should be canonical or non-canonical.
   */
  productsWithCanonicalLink: Set<string>;
}

// =============================================================================
// HELPERS
// =============================================================================

function isFieldEnabled(mappings: EffectiveFieldMapping[], fieldKey: string): boolean {
  return mappings.some((m) => m.fieldKey === fieldKey);
}

/**
 * Extract raw SKU/barcode identifiers from variant data.
 */
function extractRawIdentifiers(variantData: Record<string, unknown>): {
  sku: string | undefined;
  barcode: string | undefined;
} {
  const rawSku = getValueByPath(variantData, "sku");
  const rawBarcode = getValueByPath(variantData, "barcode");

  return {
    sku: rawSku ? String(rawSku).trim() || undefined : undefined,
    barcode: rawBarcode ? String(rawBarcode).trim() || undefined : undefined,
  };
}

function computeProductHash(
  extracted: ExtractedValues,
  tagIds: string[]
): string {
  const data = {
    product: extracted.product,
    referenceEntities: extracted.referenceEntities,
    tags: tagIds.sort(),
  };
  const str = JSON.stringify(data);
  return createHash("sha256").update(str).digest("hex").slice(0, 32);
}

function createEmptyPendingOps(): Omit<PendingOperations, 'productCreates'> & { productCreate?: ProductCreateOp } {
  return {
    productUpdates: [],
    productCommercialUpserts: [],
    productLinkUpserts: [],
    tagAssignments: [],
    variantUpdates: [],
    variantCreates: [],
    variantLinkUpserts: [],
    variantAttributeAssignments: [],
    variantDisplayOverrides: [],
  };
}

// =============================================================================
// MAIN PROCESSOR (SYNCHRONOUS - NO DB QUERIES)
// =============================================================================

/**
 * Process a single product. This is now SYNCHRONOUS and does no DB queries.
 * All lookup data is pre-fetched and passed in via preFetched.
 * 
 * @param ctx - Sync context
 * @param externalProduct - The external product to process
 * @param mappings - Field mappings
 * @param caches - In-memory caches
 * @param preFetched - Pre-fetched lookup data (links, matches, handles)
 * @param usedHandlesInBatch - Set of handles already used in this batch (to avoid collisions)
 */
export function processProduct(
  ctx: SyncContext,
  externalProduct: FetchedProduct,
  mappings: EffectiveFieldMapping[],
  caches: SyncCaches,
  preFetched: PreFetchedData,
  usedHandlesInBatch: Set<string>
): ProcessedProductResult {
  let productCreated = false;
  let productUpdated = false;
  const pendingOps = createEmptyPendingOps();

  try {
    const productExtracted = extractValues(externalProduct.data, mappings);
    const productName = (productExtracted.product.name as string) || "Unnamed Product";

    // Pre-compute tag IDs for hash calculation
    const tagNames = productExtracted.relations.tags ?? [];
    const tagIds = tagNames
      .map((name: string) => getCachedTag(caches, name)?.id)
      .filter((id: string | undefined): id is string => !!id);

    // Compute product hash
    const productHash = computeProductHash(productExtracted, tagIds);

    // STEP 1: Find or create product (using pre-fetched data - NO DB QUERIES)
    let productId: string;
    let productHandle: string;

    const existingLink = preFetched.productLinks.get(externalProduct.externalId);

    // Determine if this source product is canonical within this integration.
    // - If we have an existing link, use its isCanonical status
    // - If creating a new link, check if the product already has a canonical link from this integration
    let isCanonical = true; // Default: first link is canonical

    if (existingLink) {
      // Product already linked to this integration
      productId = existingLink.productId;
      productHandle = existingLink.productHandle;
      isCanonical = existingLink.isCanonical;
    } else {
      // Check our in-batch cache first
      const cached = getCachedProduct(caches, externalProduct.externalId);
      if (cached) {
        productId = cached.id;
        productHandle = cached.productHandle;
        productCreated = cached.created;
        // For cached products, check if this product already has a canonical link
        if (!productCreated && preFetched.productsWithCanonicalLink.has(productId)) {
          isCanonical = false;
        }
      } else {
        // Check pre-fetched identifier matches (replaces findProductByVariantIdentifiers)
        const identifierMatch = preFetched.identifierMatches.get(externalProduct.externalId);

        if (identifierMatch) {
          // Matched to existing product via SKU/barcode
          productId = identifierMatch.productId;
          productHandle = identifierMatch.productHandle;
          // Check if this product already has a canonical link from this integration
          if (preFetched.productsWithCanonicalLink.has(productId)) {
            isCanonical = false;
          }
        } else {
          // Need to create a new product - generate handle (using pre-fetched taken handles)
          productHandle = generateUniqueHandleSync(
            productName,
            preFetched.takenHandles,
            usedHandlesInBatch
          );
          usedHandlesInBatch.add(productHandle);

          // Use placeholder ID - will be replaced after batch insert
          productId = `__pending:${externalProduct.externalId}`;
          productCreated = true;
          // New products are always canonical (first link)
          isCanonical = true;

          // Queue product creation
          const categoryEnabled = isFieldEnabled(mappings, "product.categoryId");
          const categoryId = categoryEnabled ? (productExtracted.referenceEntities.categoryId ?? null) : null;

          pendingOps.productCreate = {
            externalId: externalProduct.externalId,
            name: productName,
            productHandle,
            description: (productExtracted.product.description as string) ?? null,
            categoryId,
            imageUrl: (productExtracted.product.imagePath as string) ?? null,
          };

          // Queue commercial data for newly created product
          const commercialData = buildProductCommercialData(productId, productExtracted);
          if (commercialData) {
            pendingOps.productCommercialUpserts.push(commercialData);
          }
        }

        // Queue product link upsert (with isCanonical)
        pendingOps.productLinkUpserts.push({
          brandIntegrationId: ctx.brandIntegrationId,
          productId,
          externalId: externalProduct.externalId,
          externalName: productName,
          lastSyncedHash: productHash,
          isCanonical,
        });

        // Cache for other products in this batch that might reference the same external ID
        cacheProduct(caches, externalProduct.externalId, productId, productHandle, productCreated);
      }
    }

    // FAST PATH: If hash matches, skip updates entirely
    const hashMatches = existingLink?.lastSyncedHash === productHash;

    // STEP 2: Queue product update if needed
    // Only canonical source products write to product-level.
    // Non-canonical sources will write to variant overrides in processVariantsSync.
    if (isCanonical && !hashMatches && !productCreated && !isProductUpdated(caches, productId)) {
      const updateData = buildProductUpdateData(productExtracted, mappings);
      if (Object.keys(updateData).length > 0) {
        pendingOps.productUpdates.push({ id: productId, ...updateData });
        productUpdated = true;
      }

      // Queue commercial data upsert (canonical sources only)
      const commercialData = buildProductCommercialData(productId, productExtracted);
      if (commercialData) {
        pendingOps.productCommercialUpserts.push(commercialData);
      }

      markProductUpdated(caches, productId);
    }

    // STEP 3: Queue tags if needed (canonical sources only)
    if (isCanonical && !hashMatches && tagIds.length) {
      pendingOps.tagAssignments.push({ productId, tagIds });
    }

    // Queue link hash update if needed (existing link, hash changed)
    if (existingLink && !hashMatches) {
      pendingOps.productLinkUpserts.push({
        brandIntegrationId: ctx.brandIntegrationId,
        productId,
        externalId: externalProduct.externalId,
        externalName: productName,
        lastSyncedHash: productHash,
        // Preserve existing isCanonical status
        isCanonical: existingLink.isCanonical,
      });
    }

    // STEP 4: Process variants (returns pending operations)
    // Always allow variant-level SKU/barcode matching when there's no existing variant link.
    // Previously this was incorrectly set to false when the product was matched by identifier,
    // which caused variants to be duplicated instead of linked to existing ones.
    // Product-level matching and variant-level matching are separate concerns.
    const matchViaIdentifiers = !existingLink;
    const variantResult = processVariantsSync(
      ctx,
      productId,
      externalProduct,
      mappings,
      caches,
      preFetched,
      matchViaIdentifiers,
      isCanonical,
      productExtracted  // Pass product-level extracted values for display override comparison
    );

    // Merge variant pending ops
    pendingOps.variantUpdates.push(...variantResult.variantUpdates);
    pendingOps.variantCreates.push(...variantResult.variantCreates);
    pendingOps.variantLinkUpserts.push(...variantResult.variantLinkUpserts);
    pendingOps.variantAttributeAssignments.push(...variantResult.variantAttributeAssignments);
    pendingOps.variantDisplayOverrides.push(...variantResult.variantDisplayOverrides);

    return {
      success: true,
      productCreated,
      productUpdated,
      variantsCreated: variantResult.variantsCreated,
      variantsUpdated: variantResult.variantsUpdated,
      variantsSkipped: variantResult.variantsSkipped,
      productId,
      pendingOps,
    };
  } catch (error) {
    return {
      success: false,
      productCreated: false,
      productUpdated: false,
      variantsCreated: 0,
      variantsUpdated: 0,
      variantsSkipped: 0,
      error: error instanceof Error ? error.message : String(error),
      pendingOps,
    };
  }
}

/**
 * Generate a unique handle synchronously using pre-fetched taken handles.
 * Falls back to suffix if base slug is taken.
 */
function generateUniqueHandleSync(
  name: string,
  takenHandles: Set<string>,
  usedInBatch: Set<string>
): string {
  const baseSlug = slugifyProductName(name);

  if (!baseSlug) {
    // Fallback for empty names
    const suffix = String(randomInt(1000, 10000));
    return `product-${suffix}`;
  }

  // Check if base slug is available
  if (!takenHandles.has(baseSlug) && !usedInBatch.has(baseSlug)) {
    return baseSlug;
  }

  // Try with random suffixes (synchronous, no DB check needed)
  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = String(randomInt(1000, 10000));
    const candidate = `${baseSlug}-${suffix}`;
    if (!takenHandles.has(candidate) && !usedInBatch.has(candidate)) {
      return candidate;
    }
  }

  // Last resort: use timestamp-based suffix
  const timestamp = Date.now().toString(36);
  return `${baseSlug}-${timestamp}`;
}

/**
 * Build update data for the `products` table only.
 */
function buildProductUpdateData(
  extracted: ReturnType<typeof extractValues>,
  mappings: EffectiveFieldMapping[]
): Omit<ProductUpdateOp, 'id'> {
  const updateData: Omit<ProductUpdateOp, 'id'> = {};

  if (extracted.product.name) updateData.name = extracted.product.name;
  if (extracted.product.description !== undefined) updateData.description = extracted.product.description;
  // Only set categoryId if the field is enabled and a valid value exists
  if (isFieldEnabled(mappings, "product.categoryId") && extracted.referenceEntities.categoryId) {
    updateData.categoryId = extracted.referenceEntities.categoryId;
  }

  return updateData;
}

/**
 * Build upsert data for the `product_commercial` table.
 */
function buildProductCommercialData(
  productId: string,
  extracted: ReturnType<typeof extractValues>
): ProductCommercialOp | null {
  const hasCommercialData =
    extracted.product.webshopUrl !== undefined ||
    extracted.product.price !== undefined ||
    extracted.product.currency !== undefined ||
    extracted.product.salesStatus !== undefined;

  if (!hasCommercialData) return null;

  return {
    productId,
    webshopUrl: extracted.product.webshopUrl ?? null,
    price: extracted.product.price?.toString() ?? null,
    currency: extracted.product.currency ?? null,
    salesStatus: extracted.product.salesStatus ?? null,
  };
}

// =============================================================================
// VARIANT PROCESSING (SYNCHRONOUS - NO DB WRITES)
// =============================================================================

interface ProcessVariantsResult {
  variantsCreated: number;
  variantsUpdated: number;
  variantsSkipped: number;
  variantUpdates: PendingOperations['variantUpdates'];
  variantCreates: PendingOperations['variantCreates'];
  variantLinkUpserts: PendingOperations['variantLinkUpserts'];
  variantAttributeAssignments: PendingOperations['variantAttributeAssignments'];
  /** Variant display overrides for non-canonical source products */
  variantDisplayOverrides: PendingOperations['variantDisplayOverrides'];
}

/**
 * Process variants synchronously - compute what needs to change without DB writes.
 * All DB operations are returned as pending operations to be batched at engine level.
 * 
 * @param isCanonical - Whether this source product is canonical within its integration.
 *                      Non-canonical sources write to variant display overrides.
 * @param productExtracted - Product-level extracted values for display override comparison.
 */
function processVariantsSync(
  ctx: SyncContext,
  productId: string,
  externalProduct: FetchedProduct,
  mappings: EffectiveFieldMapping[],
  caches: SyncCaches,
  preFetched: PreFetchedData,
  matchViaIdentifiers: boolean,
  isCanonical: boolean,
  productExtracted: ExtractedValues
): ProcessVariantsResult {
  let skipped = 0;
  const variantUpdates: PendingOperations['variantUpdates'] = [];
  const variantCreates: PendingOperations['variantCreates'] = [];
  const variantLinkUpserts: PendingOperations['variantLinkUpserts'] = [];
  const variantAttributeAssignments: PendingOperations['variantAttributeAssignments'] = [];
  const variantDisplayOverrides: PendingOperations['variantDisplayOverrides'] = [];

  const skuEnabled = isFieldEnabled(mappings, "variant.sku");
  const barcodeEnabled = isFieldEnabled(mappings, "variant.barcode");
  const attributesEnabled = isFieldEnabled(mappings, "variant.attributes");

  const existingVariants = preFetched.existingVariantsByProduct.get(productId) ?? [];
  const existingById = new Map(existingVariants.map((v) => [v.id, v]));
  const existingByBarcode = new Map(existingVariants.filter((v) => v.barcode?.trim()).map((v) => [v.barcode!.toLowerCase(), v]));
  const existingBySku = new Map(existingVariants.filter((v) => v.sku?.trim()).map((v) => [v.sku!.toLowerCase(), v]));

  const usedVariantIds = new Set<string>();

  // Extract product-level values for override comparison
  const productName = productExtracted.product.name as string | undefined;
  const productDescription = productExtracted.product.description as string | undefined;
  const productImagePath = productExtracted.product.imagePath as string | undefined;

  for (const externalVariant of externalProduct.variants) {
    const variantData = { ...externalVariant.data, product: externalProduct.data };
    const extracted = extractValues(variantData, mappings);
    const hash = computeHash(extracted);
    const rawIds = extractRawIdentifiers(variantData);
    const existingLink = preFetched.variantLinks.get(externalVariant.externalId);

    // FAST PATH: Hash matches = no changes
    if (existingLink?.lastSyncedHash === hash) {
      skipped++;
      continue;
    }

    const sku = skuEnabled ? (extracted.variant.sku as string) ?? null : null;
    const barcode = barcodeEnabled ? (extracted.variant.barcode as string) ?? null : null;

    // Resolve variant attributes to IDs
    const attributeValueIds = attributesEnabled
      ? resolveAttributeValueIds(parseSelectedOptions(variantData), caches)
      : [];

    const matchResult = findExistingVariant(
      existingLink, existingById, existingByBarcode, existingBySku,
      rawIds, usedVariantIds, matchViaIdentifiers, preFetched.globalVariantIndex
    );

    if (matchResult) {
      const existingVariant = matchResult.variant;
      // Build update data (only SKU and barcode - we don't update identifiers from global matches
      // as those would require understanding the target product context)
      const updateData: { id: string; sku?: string | null; barcode?: string | null } = { id: existingVariant.id };
      let hasChanges = false;

      // Only update SKU/barcode if we matched within the same product (not a global match)
      // Global matches may involve variants from other products with valid identifiers
      if (!matchResult.productId) {
        // Get the matched variant's current SKU/barcode from the existingVariants map
        const matchedVariantData = existingById.get(existingVariant.id);
        if (matchedVariantData) {
          if (skuEnabled && matchedVariantData.sku !== sku) { updateData.sku = sku; hasChanges = true; }
          if (barcodeEnabled && matchedVariantData.barcode !== barcode) { updateData.barcode = barcode; hasChanges = true; }
        }
      }

      if (hasChanges) {
        variantUpdates.push(updateData);
      } else {
        skipped++;
      }

      // Queue attribute assignment for existing variant (always replace to sync state)
      if (attributesEnabled && attributeValueIds.length > 0) {
        variantAttributeAssignments.push({
          variantId: existingVariant.id,
          attributeValueIds,
        });
      }

      // NON-CANONICAL SOURCE: Queue variant display overrides if values differ from product-level
      // This handles many-to-one mappings where multiple source products link to the same Avelero product.
      // The canonical source writes to product-level; non-canonical sources write to variant overrides.
      if (!isCanonical) {
        const override: PendingOperations['variantDisplayOverrides'][number] = {
          variantId: existingVariant.id,
          sourceIntegration: ctx.integrationSlug,
          sourceExternalId: externalProduct.externalId,
        };
        let hasOverride = false;

        // Only create override if value differs from product-level
        const sourceName = productExtracted.product.name as string | undefined;
        const sourceDescription = productExtracted.product.description as string | undefined;
        const sourceImagePath = productExtracted.product.imagePath as string | undefined;

        if (sourceName && sourceName !== productName) {
          override.name = sourceName;
          hasOverride = true;
        }
        if (sourceDescription !== undefined && sourceDescription !== productDescription) {
          override.description = sourceDescription;
          hasOverride = true;
        }
        if (sourceImagePath && sourceImagePath !== productImagePath) {
          override.imagePath = sourceImagePath;
          hasOverride = true;
        }

        // Only queue override if at least one field differs
        if (hasOverride) {
          variantDisplayOverrides.push(override);
        }
      }

      // Queue link upsert
      variantLinkUpserts.push({
        brandIntegrationId: ctx.brandIntegrationId,
        variantId: existingVariant.id,
        externalId: externalVariant.externalId,
        externalProductId: externalProduct.externalId,
        externalSku: rawIds.sku ?? null,
        externalBarcode: rawIds.barcode ?? null,
        lastSyncedHash: hash,
      });
    } else {
      // Queue variant creation with attribute values
      variantCreates.push({
        productId,
        sku,
        barcode,
        attributeValueIds,
        linkData: {
          brandIntegrationId: ctx.brandIntegrationId,
          externalId: externalVariant.externalId,
          externalProductId: externalProduct.externalId,
          externalSku: rawIds.sku ?? null,
          externalBarcode: rawIds.barcode ?? null,
          lastSyncedHash: hash,
        },
      });
    }
  }

  return {
    variantsCreated: variantCreates.length,
    variantsUpdated: variantUpdates.length,
    variantsSkipped: skipped,
    variantUpdates,
    variantCreates,
    variantLinkUpserts,
    variantAttributeAssignments,
    variantDisplayOverrides,
  };
}

/**
 * Find an existing variant to link to.
 * 
 * Priority order:
 * 1. Match via existing integration link (variantId from link)
 * 2. Match via product-scoped identifiers (barcode/SKU within the product)
 * 3. Match via global variant index (barcode/SKU across ALL brand variants) - NEW for multi-source
 */
function findExistingVariant<T extends { id: string }>(
  existingLink: { variantId: string } | undefined,
  existingById: Map<string, T>,
  existingByBarcode: Map<string, T>,
  existingBySku: Map<string, T>,
  rawIds: { sku?: string; barcode?: string },
  usedVariantIds: Set<string>,
  matchViaIdentifiers: boolean,
  globalVariantIndex?: GlobalVariantIndex
): { variant: T; productId?: string } | undefined {
  // Priority 1: Match via existing integration link
  if (existingLink) {
    const v = existingById.get(existingLink.variantId);
    if (v) { usedVariantIds.add(v.id); return { variant: v }; }
  }

  // Priority 2: Match via product-scoped barcode/SKU identifiers
  if (matchViaIdentifiers) {
    if (rawIds.barcode) {
      const v = existingByBarcode.get(rawIds.barcode.toLowerCase());
      if (v && !usedVariantIds.has(v.id)) { usedVariantIds.add(v.id); return { variant: v }; }
    }
    if (rawIds.sku) {
      const v = existingBySku.get(rawIds.sku.toLowerCase());
      if (v && !usedVariantIds.has(v.id)) { usedVariantIds.add(v.id); return { variant: v }; }
    }
  }

  // Priority 3: Match via global variant index (multi-source integration support)
  // This allows matching variants from other products in the brand
  if (matchViaIdentifiers && globalVariantIndex) {
    if (rawIds.barcode) {
      const match = globalVariantIndex.byBarcode.get(rawIds.barcode.toLowerCase());
      if (match && !usedVariantIds.has(match.variantId)) {
        usedVariantIds.add(match.variantId);
        // Return a synthetic variant object with the matched ID
        return {
          variant: { id: match.variantId } as T,
          productId: match.productId
        };
      }
    }
    if (rawIds.sku) {
      const match = globalVariantIndex.bySku.get(rawIds.sku.toLowerCase());
      if (match && !usedVariantIds.has(match.variantId)) {
        usedVariantIds.add(match.variantId);
        return {
          variant: { id: match.variantId } as T,
          productId: match.productId
        };
      }
    }
  }

  return undefined;
}
