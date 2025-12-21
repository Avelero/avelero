/**
 * Product Processor
 *
 * Processes a single product with all its variants.
 * Returns pending operations to be batched at the engine level.
 */

import type { Database } from "@v1/db/client";
import { eq, and, inArray } from "@v1/db/queries";
import {
  type ProductLinkData,
  findProductByVariantIdentifiers,
  type VariantLinkData,
  type PreFetchedVariant,
} from "@v1/db/queries/integrations";
import { productVariants, products } from "@v1/db/schema";
import { generateUniqueUpids, generateUniqueProductHandle } from "@v1/db/utils";
import type { EffectiveFieldMapping } from "./extractor";
import { extractValues, computeHash, getValueByPath } from "./extractor";
import type { ExtractedValues } from "./types";
import { createHash } from "node:crypto";
import {
  type SyncCaches,
  getCachedTag,
  getCachedProduct,
  cacheProduct,
  markProductUpdated,
  isProductUpdated,
} from "./caches";
import { processImageUrl } from "./matcher";
import type { FetchedProduct, FetchedVariant, SyncContext } from "./types";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Pending operations to be batched at the engine level.
 */
export interface PendingOperations {
  productUpdates: Array<{ id: string; data: Record<string, unknown> }>;
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
  pendingOps: PendingOperations;
}

export interface PreFetchedData {
  productLinks: Map<string, ProductLinkData>;
  variantLinks: Map<string, VariantLinkData>;
  existingVariantsByProduct: Map<string, PreFetchedVariant[]>;
}

// =============================================================================
// HELPERS
// =============================================================================

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

function isFieldEnabled(mappings: EffectiveFieldMapping[], fieldKey: string): boolean {
  return mappings.some((m) => m.fieldKey === fieldKey);
}

function computeProductHash(
  extracted: ExtractedValues,
  tagIds: string[]
): string {
  const data = {
    product: extracted.product,
    referenceEntities: extracted.referenceEntities,
    tags: tagIds.sort(),
    // NOTE: sizeOrder and colorOrder removed as part of variant attribute migration.
  };
  const str = JSON.stringify(data);
  return createHash("sha256").update(str).digest("hex").slice(0, 32);
}

function createEmptyPendingOps(): PendingOperations {
  return {
    productUpdates: [],
    productLinkUpserts: [],
    tagAssignments: [],
    variantUpdates: [],
    variantCreates: [],
    variantLinkUpserts: [],
  };
}

// =============================================================================
// MAIN PROCESSOR
// =============================================================================

export async function processProduct(
  db: Database,
  ctx: SyncContext,
  externalProduct: FetchedProduct,
  mappings: EffectiveFieldMapping[],
  caches: SyncCaches,
  preFetched: PreFetchedData
): Promise<ProcessedProductResult> {
  let productCreated = false;
  let productUpdated = false;
  const pendingOps = createEmptyPendingOps();

  try {
    const productExtracted = extractValues(externalProduct.data, mappings);
    const productName = (productExtracted.product.name as string) || "Unnamed Product";

    // Pre-compute tag IDs and order arrays for hash calculation
    const tagNames = productExtracted.relations.tags ?? [];
    const tagIds = tagNames
      .map((name) => getCachedTag(caches, name)?.id)
      .filter((id): id is string => !!id);
    // NOTE: buildOrderArrays removed as part of variant attribute migration.
    // sizeOrder and colorOrder no longer exist on products table.

    // Compute product hash
    const productHash = computeProductHash(productExtracted, tagIds);

    // STEP 1: Find or create product
    let productId: string;
    let productHandle: string;

    const existingLink = preFetched.productLinks.get(externalProduct.externalId);
    if (existingLink) {
      productId = existingLink.productId;
      productHandle = existingLink.productHandle;
    } else {
      const cached = getCachedProduct(caches, externalProduct.externalId);
      if (cached) {
        productId = cached.id;
        productHandle = cached.productHandle;
        productCreated = cached.created;
      } else {
        const identifiers = externalProduct.variants.map((v) => {
          const variantData = { ...v.data, product: externalProduct.data };
          return extractRawIdentifiers(variantData);
        });

        const matched = await findProductByVariantIdentifiers(db, ctx.brandId, identifiers);

        if (matched) {
          productId = matched.productId;
          productHandle = matched.productHandle;
        } else {
          // Create product immediately (needed for variant creation)
          const newProduct = await createProduct(db, ctx, productName, productExtracted, externalProduct, mappings, caches);
          productId = newProduct.id;
          productHandle = newProduct.productHandle;
          productCreated = true;
        }

        // Queue product link upsert
        pendingOps.productLinkUpserts.push({
          brandIntegrationId: ctx.brandIntegrationId,
          productId,
          externalId: externalProduct.externalId,
          externalName: productName,
          lastSyncedHash: productHash,
        });

        cacheProduct(caches, externalProduct.externalId, productId, productHandle, productCreated);
      }
    }

    // FAST PATH: If hash matches, skip updates entirely
    const hashMatches = existingLink?.lastSyncedHash === productHash;

    // STEP 2: Queue product update if needed
    if (!hashMatches && !productCreated && !isProductUpdated(caches, productId)) {
      const updateData = buildProductUpdateData(productExtracted);
      if (Object.keys(updateData).length > 0) {
        pendingOps.productUpdates.push({ id: productId, data: updateData });
        productUpdated = true;
      }
      markProductUpdated(caches, productId);
      
      // Fire-and-forget image upload
      const imageUrl = productExtracted.product.imagePath as string | undefined;
      if (imageUrl) {
        processImageUrl(ctx.storageClient, ctx.brandId, productId, imageUrl)
          .then((path) => { if (path) db.update(products).set({ imagePath: path }).where(eq(products.id, productId)); })
          .catch(() => {});
      }
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
    const matchViaIdentifiers = !existingLink;
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

function buildProductUpdateData(
  extracted: ReturnType<typeof extractValues>
): Record<string, unknown> {
  const updateData: Record<string, unknown> = {};

  if (extracted.product.name) updateData.name = extracted.product.name;
  if (extracted.product.description !== undefined) updateData.description = extracted.product.description;
  if (extracted.product.webshopUrl !== undefined) updateData.webshopUrl = extracted.product.webshopUrl;
  if (extracted.product.price !== undefined) updateData.price = extracted.product.price?.toString();
  if (extracted.product.currency !== undefined) updateData.currency = extracted.product.currency;
  if (extracted.product.salesStatus !== undefined) updateData.salesStatus = extracted.product.salesStatus;
  if (extracted.referenceEntities.categoryId) updateData.categoryId = extracted.referenceEntities.categoryId;
  // NOTE: sizeOrder and colorOrder removed as part of variant attribute migration.

  return updateData;
}

async function createProduct(
  db: Database,
  ctx: SyncContext,
  name: string,
  extracted: ReturnType<typeof extractValues>,
  externalProduct: FetchedProduct,
  mappings: EffectiveFieldMapping[],
  caches: SyncCaches
): Promise<{ id: string; productHandle: string }> {
  const productHandle = await generateUniqueProductHandle({
    name,
    isTaken: async (candidate) => {
      const [row] = await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.brandId, ctx.brandId), eq(products.productHandle, candidate)))
        .limit(1);
      return Boolean(row);
    },
  });

  // NOTE: sizeOrder and colorOrder removed as part of variant attribute migration.

  const [created] = await db
    .insert(products)
    .values({
      brandId: ctx.brandId,
      name,
      productHandle,
      description: (extracted.product.description as string) ?? null,
      imagePath: null,
      status: "unpublished",
      categoryId: extracted.referenceEntities.categoryId ?? null,
    })
    .returning({ id: products.id });

  if (!created) throw new Error(`Failed to create product: ${productHandle}`);

  // Fire-and-forget image upload
  const imageUrl = extracted.product.imagePath as string | undefined;
  if (imageUrl) {
    processImageUrl(ctx.storageClient, ctx.brandId, created.id, imageUrl)
      .then((path) => { if (path) db.update(products).set({ imagePath: path }).where(eq(products.id, created.id)); })
      .catch(() => {});
  }

  return { id: created.id, productHandle };
}

// NOTE: buildOrderArrays function removed as part of variant attribute migration.
// sizeOrder and colorOrder no longer exist on products table.

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

  const skuEnabled = isFieldEnabled(mappings, "variant.sku");
  const barcodeEnabled = isFieldEnabled(mappings, "variant.barcode");

  const existingVariants = preFetched.existingVariantsByProduct.get(productId) ?? [];
  const existingById = new Map(existingVariants.map((v) => [v.id, v]));
  // NOTE: existingByKey (color/size key) removed as part of variant attribute migration.
  // Variant matching now relies on link, barcode, and SKU only.
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

    // NOTE: colorId/sizeId lookup removed as part of variant attribute migration.
    // TODO: In Phase 3, this will be replaced with generic attribute value assignment.
    const sku = skuEnabled ? (extracted.variant.sku as string) ?? null : null;
    const barcode = barcodeEnabled ? (extracted.variant.barcode as string) ?? null : null;

    const existingVariant = findExistingVariant(
      existingLink, existingById, existingByBarcode, existingBySku, 
      rawIds, usedVariantIds, matchViaIdentifiers
    );

    if (existingVariant) {
      // Build update data (only SKU and barcode now - colorId/sizeId removed)
      const updateData: { id: string; sku?: string | null; barcode?: string | null } = { id: existingVariant.id };
      let hasChanges = false;
      
      if (skuEnabled && existingVariant.sku !== sku) { updateData.sku = sku; hasChanges = true; }
      if (barcodeEnabled && existingVariant.barcode !== barcode) { updateData.barcode = barcode; hasChanges = true; }
      
      if (hasChanges) {
        variantUpdates.push(updateData);
      } else { 
        skipped++; 
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
      // Queue variant creation (colorId/sizeId removed, will be handled by attributes in Phase 3)
      variantCreates.push({
        productId,
        sku,
        barcode,
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

  // NOTE: Key-based matching (colorId:sizeId) removed as part of variant attribute migration.
  // In the future, attribute-based matching may be added in Phase 3.

  return undefined;
}

// NOTE: makeKey function removed as part of variant attribute migration.
// colorId and sizeId no longer exist on product_variants.



