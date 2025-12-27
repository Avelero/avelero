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
    if (existingLink) {
      // Product already linked to this integration
      productId = existingLink.productId;
      productHandle = existingLink.productHandle;
    } else {
      // Check our in-batch cache first
      const cached = getCachedProduct(caches, externalProduct.externalId);
      if (cached) {
        productId = cached.id;
        productHandle = cached.productHandle;
        productCreated = cached.created;
      } else {
        // Check pre-fetched identifier matches (replaces findProductByVariantIdentifiers)
        const identifierMatch = preFetched.identifierMatches.get(externalProduct.externalId);
        
        if (identifierMatch) {
          // Matched to existing product via SKU/barcode
          productId = identifierMatch.productId;
          productHandle = identifierMatch.productHandle;
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

        // Queue product link upsert
        pendingOps.productLinkUpserts.push({
          brandIntegrationId: ctx.brandIntegrationId,
          productId,
          externalId: externalProduct.externalId,
          externalName: productName,
          lastSyncedHash: productHash,
        });

        // Cache for other products in this batch that might reference the same external ID
        cacheProduct(caches, externalProduct.externalId, productId, productHandle, productCreated);
      }
    }

    // FAST PATH: If hash matches, skip updates entirely
    const hashMatches = existingLink?.lastSyncedHash === productHash;

    // STEP 2: Queue product update if needed
    if (!hashMatches && !productCreated && !isProductUpdated(caches, productId)) {
      const updateData = buildProductUpdateData(productExtracted, mappings);
      if (Object.keys(updateData).length > 0) {
        pendingOps.productUpdates.push({ id: productId, ...updateData });
        productUpdated = true;
      }
      
      // Queue commercial data upsert
      const commercialData = buildProductCommercialData(productId, productExtracted);
      if (commercialData) {
        pendingOps.productCommercialUpserts.push(commercialData);
      }
      
      markProductUpdated(caches, productId);
    }

    // STEP 3: Queue tags if needed
    if (!hashMatches && tagIds.length) {
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
      });
    }

    // STEP 4: Process variants (returns pending operations)
    const matchViaIdentifiers = !existingLink && !preFetched.identifierMatches.has(externalProduct.externalId);
    const variantResult = processVariantsSync(
      ctx,
      productId,
      externalProduct,
      mappings,
      caches,
      preFetched,
      matchViaIdentifiers
    );
    
    // Merge variant pending ops
    pendingOps.variantUpdates.push(...variantResult.variantUpdates);
    pendingOps.variantCreates.push(...variantResult.variantCreates);
    pendingOps.variantLinkUpserts.push(...variantResult.variantLinkUpserts);
    pendingOps.variantAttributeAssignments.push(...variantResult.variantAttributeAssignments);

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
}

/**
 * Process variants synchronously - compute what needs to change without DB writes.
 * All DB operations are returned as pending operations to be batched at engine level.
 */
function processVariantsSync(
  ctx: SyncContext,
  productId: string,
  externalProduct: FetchedProduct,
  mappings: EffectiveFieldMapping[],
  caches: SyncCaches,
  preFetched: PreFetchedData,
  matchViaIdentifiers: boolean
): ProcessVariantsResult {
  let skipped = 0;
  const variantUpdates: PendingOperations['variantUpdates'] = [];
  const variantCreates: PendingOperations['variantCreates'] = [];
  const variantLinkUpserts: PendingOperations['variantLinkUpserts'] = [];
  const variantAttributeAssignments: PendingOperations['variantAttributeAssignments'] = [];

  const skuEnabled = isFieldEnabled(mappings, "variant.sku");
  const barcodeEnabled = isFieldEnabled(mappings, "variant.barcode");
  const attributesEnabled = isFieldEnabled(mappings, "variant.attributes");

  const existingVariants = preFetched.existingVariantsByProduct.get(productId) ?? [];
  const existingById = new Map(existingVariants.map((v) => [v.id, v]));
  const existingByBarcode = new Map(existingVariants.filter((v) => v.barcode?.trim()).map((v) => [v.barcode!.toLowerCase(), v]));
  const existingBySku = new Map(existingVariants.filter((v) => v.sku?.trim()).map((v) => [v.sku!.toLowerCase(), v]));
  
  const usedVariantIds = new Set<string>();

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

    const existingVariant = findExistingVariant(
      existingLink, existingById, existingByBarcode, existingBySku, 
      rawIds, usedVariantIds, matchViaIdentifiers
    );

    if (existingVariant) {
      // Build update data (only SKU and barcode)
      const updateData: { id: string; sku?: string | null; barcode?: string | null } = { id: existingVariant.id };
      let hasChanges = false;
      
      if (skuEnabled && existingVariant.sku !== sku) { updateData.sku = sku; hasChanges = true; }
      if (barcodeEnabled && existingVariant.barcode !== barcode) { updateData.barcode = barcode; hasChanges = true; }
      
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
  };
}

function findExistingVariant<T extends { id: string }>(
  existingLink: { variantId: string } | undefined,
  existingById: Map<string, T>,
  existingByBarcode: Map<string, T>,
  existingBySku: Map<string, T>,
  rawIds: { sku?: string; barcode?: string },
  usedVariantIds: Set<string>,
  matchViaIdentifiers: boolean
): T | undefined {
  // Priority 1: Match via existing integration link
  if (existingLink) {
    const v = existingById.get(existingLink.variantId);
    if (v) { usedVariantIds.add(v.id); return v; }
  }

  // Priority 2: Match via barcode/SKU identifiers
  if (matchViaIdentifiers) {
    if (rawIds.barcode) {
      const v = existingByBarcode.get(rawIds.barcode.toLowerCase());
      if (v && !usedVariantIds.has(v.id)) { usedVariantIds.add(v.id); return v; }
    }
    if (rawIds.sku) {
      const v = existingBySku.get(rawIds.sku.toLowerCase());
      if (v && !usedVariantIds.has(v.id)) { usedVariantIds.add(v.id); return v; }
    }
  }

  return undefined;
}
