/**
 * Product Processor
 *
 * Processes a single product with all its variants.
 */

import type { Database } from "@v1/db/client";
import { eq, and, inArray } from "@v1/db/queries";
import {
  upsertProductLink,
  type ProductLinkData,
  batchUpsertVariantLinks,
  findProductByVariantIdentifiers,
  type VariantLinkData,
  type PreFetchedVariant,
} from "@v1/db/queries/integrations";
import { setProductTags } from "@v1/db/queries/products";
import { productVariants, products } from "@v1/db/schema";
import { generateUniqueUpids, generateUniqueProductHandle } from "@v1/db/utils";
import type { EffectiveFieldMapping } from "./extractor";
import { extractValues, computeHash, getValueByPath } from "./extractor";
import type { ExtractedValues } from "./types";
import { createHash } from "node:crypto";
import {
  type SyncCaches,
  getCachedColor,
  getCachedSize,
  getCachedTag,
  getCachedProduct,
  cacheProduct,
  markProductUpdated,
  isProductUpdated,
} from "./caches";
import { processImageUrl } from "./matcher";
import type { FetchedProduct, FetchedVariant, SyncContext } from "./types";

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extract raw SKU and barcode from variant data, bypassing field config.
 * Used for product matching - we always want to match by SKU/barcode even if
 * the user chose not to populate those fields.
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

/**
 * Check if a field is enabled in the mappings.
 */
function isFieldEnabled(mappings: EffectiveFieldMapping[], fieldKey: string): boolean {
  return mappings.some((m) => m.fieldKey === fieldKey);
}

/**
 * Compute a hash for product-level data (includes product fields + tags + order arrays).
 * Used to detect if anything has changed since last sync.
 */
function computeProductHash(
  extracted: ExtractedValues,
  tagIds: string[],
  sizeOrder: string[],
  colorOrder: string[]
): string {
  const data = {
    product: extracted.product,
    referenceEntities: extracted.referenceEntities,
    tags: tagIds.sort(), // Sort for consistent ordering
    sizeOrder,
    colorOrder,
  };
  const str = JSON.stringify(data);
  return createHash("sha256").update(str).digest("hex").slice(0, 32);
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
}

export interface PreFetchedData {
  productLinks: Map<string, ProductLinkData>;
  variantLinks: Map<string, VariantLinkData>;
  existingVariantsByProduct: Map<string, PreFetchedVariant[]>;
}

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

  try {
    const productExtracted = extractValues(externalProduct.data, mappings);
    const productName = (productExtracted.product.name as string) || "Unnamed Product";

    // Pre-compute tag IDs and order arrays for hash calculation
    const tagNames = productExtracted.relations.tags ?? [];
    const tagIds = tagNames
      .map((name) => getCachedTag(caches, name)?.id)
      .filter((id): id is string => !!id);
    const { sizeOrder, colorOrder } = buildOrderArrays(externalProduct, mappings, caches);

    // Compute product hash (includes product fields + tags + order arrays)
    const productHash = computeProductHash(productExtracted, tagIds, sizeOrder, colorOrder);

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
          const newProduct = await createProduct(db, ctx, productName, productExtracted, externalProduct, mappings, caches);
          productId = newProduct.id;
          productHandle = newProduct.productHandle;
          productCreated = true;
        }

        await upsertProductLink(db, {
          brandIntegrationId: ctx.brandIntegrationId,
          productId,
          externalId: externalProduct.externalId,
          externalName: productName,
          lastSyncedHash: productHash,
        });

        cacheProduct(caches, externalProduct.externalId, productId, productHandle, productCreated);
      }
    }

    // FAST PATH: If hash matches, skip updateProduct and setProductTags entirely
    const hashMatches = existingLink?.lastSyncedHash === productHash;

    // STEP 2: Update product if needed
    if (!hashMatches && !productCreated && !isProductUpdated(caches, productId)) {
      productUpdated = await updateProduct(db, ctx, productId, productExtracted, sizeOrder, colorOrder);
      markProductUpdated(caches, productId);
    }

    // STEP 3: Set tags (only if hash doesn't match)
    if (!hashMatches && tagIds.length) {
      await setProductTags(db, productId, tagIds);
    }

    // Update the link hash if we made changes (and it was an existing link)
    if (existingLink && !hashMatches) {
      await upsertProductLink(db, {
        brandIntegrationId: ctx.brandIntegrationId,
        productId,
        externalId: externalProduct.externalId,
        externalName: productName,
        lastSyncedHash: productHash,
      });
    }

    // STEP 4: Process variants
    const matchViaIdentifiers = !existingLink;
    const variantResult = await processVariants(db, ctx, productId, externalProduct, mappings, caches, preFetched, matchViaIdentifiers);

    return {
      success: true,
      productCreated,
      productUpdated,
      variantsCreated: variantResult.variantsCreated,
      variantsUpdated: variantResult.variantsUpdated,
      variantsSkipped: variantResult.variantsSkipped,
      productId,
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
    };
  }
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

  const { sizeOrder, colorOrder } = buildOrderArrays(externalProduct, mappings, caches);

  const [created] = await db
    .insert(products)
    .values({
      brandId: ctx.brandId,
      name,
      productHandle,
      description: (extracted.product.description as string) ?? null,
      primaryImagePath: null,
      status: "unpublished",
      webshopUrl: (extracted.product.webshopUrl as string) ?? null,
      price: extracted.product.price?.toString() ?? null,
      currency: (extracted.product.currency as string) ?? null,
      salesStatus: (extracted.product.salesStatus as string) ?? null,
      categoryId: extracted.referenceEntities.categoryId ?? null,
      sizeOrder,
      colorOrder,
    })
    .returning({ id: products.id });

  if (!created) throw new Error(`Failed to create product: ${productHandle}`);

  // Fire-and-forget image upload (don't block product creation)
  const imageUrl = extracted.product.primaryImagePath as string | undefined;
  if (imageUrl) {
    processImageUrl(ctx.storageClient, ctx.brandId, created.id, imageUrl)
      .then((path) => { if (path) db.update(products).set({ primaryImagePath: path }).where(eq(products.id, created.id)); })
      .catch(() => {});
  }

  return { id: created.id, productHandle };
}

async function updateProduct(
  db: Database,
  ctx: SyncContext,
  productId: string,
  extracted: ReturnType<typeof extractValues>,
  sizeOrder: string[],
  colorOrder: string[]
): Promise<boolean> {
  const updateData: Record<string, unknown> = {};

  if (extracted.product.name) updateData.name = extracted.product.name;
  if (extracted.product.description !== undefined) updateData.description = extracted.product.description;
  if (extracted.product.webshopUrl !== undefined) updateData.webshopUrl = extracted.product.webshopUrl;
  if (extracted.product.price !== undefined) updateData.price = extracted.product.price?.toString();
  if (extracted.product.currency !== undefined) updateData.currency = extracted.product.currency;
  if (extracted.product.salesStatus !== undefined) updateData.salesStatus = extracted.product.salesStatus;
  if (extracted.referenceEntities.categoryId) updateData.categoryId = extracted.referenceEntities.categoryId;

  // Fire-and-forget image upload (don't block product update)
  const imageUrl = extracted.product.primaryImagePath as string | undefined;
  if (imageUrl) {
    processImageUrl(ctx.storageClient, ctx.brandId, productId, imageUrl)
      .then((path) => { if (path) db.update(products).set({ primaryImagePath: path }).where(eq(products.id, productId)); })
      .catch(() => {});
  }

  if (sizeOrder.length) updateData.sizeOrder = sizeOrder;
  if (colorOrder.length) updateData.colorOrder = colorOrder;

  if (Object.keys(updateData).length) {
    await db.update(products).set(updateData).where(eq(products.id, productId));
    return true;
  }
  return false;
}

function buildOrderArrays(
  externalProduct: FetchedProduct,
  mappings: EffectiveFieldMapping[],
  caches: SyncCaches
): { sizeOrder: string[]; colorOrder: string[] } {
  const sizeOrder: string[] = [];
  const colorOrder: string[] = [];
  const seenSizes = new Set<string>();
  const seenColors = new Set<string>();

  for (const variant of externalProduct.variants) {
    // Merge variant data with product for extraction (needed for product.options access)
    const variantData = { ...variant.data, product: externalProduct.data };
    const extracted = extractValues(variantData, mappings);

    if (extracted.referenceEntities.sizeName) {
      const name = extracted.referenceEntities.sizeName;
      if (!seenSizes.has(name.toLowerCase())) {
        seenSizes.add(name.toLowerCase());
        const cached = getCachedSize(caches, name);
        if (cached) sizeOrder.push(cached.id);
      }
    }

    if (extracted.referenceEntities.colorName) {
      const name = extracted.referenceEntities.colorName;
      if (!seenColors.has(name.toLowerCase())) {
        seenColors.add(name.toLowerCase());
        const cached = getCachedColor(caches, name);
        if (cached) colorOrder.push(cached.id);
      }
    }
  }

  return { sizeOrder, colorOrder };
}

async function processVariants(
  db: Database,
  ctx: SyncContext,
  productId: string,
  externalProduct: FetchedProduct,
  mappings: EffectiveFieldMapping[],
  caches: SyncCaches,
  preFetched: PreFetchedData,
  matchViaIdentifiers: boolean
): Promise<{ variantsCreated: number; variantsUpdated: number; variantsSkipped: number }> {
  let updated = 0;
  let skipped = 0;

  const skuEnabled = isFieldEnabled(mappings, "variant.sku");
  const barcodeEnabled = isFieldEnabled(mappings, "variant.barcode");

  const existingVariants = preFetched.existingVariantsByProduct.get(productId) ?? [];
  const existingById = new Map(existingVariants.map((v) => [v.id, v]));
  const existingByKey = new Map(existingVariants.map((v) => [makeKey(v.colorId, v.sizeId), v]));
  const existingByBarcode = new Map(existingVariants.filter((v) => v.barcode?.trim()).map((v) => [v.barcode!.toLowerCase(), v]));
  const existingBySku = new Map(existingVariants.filter((v) => v.sku?.trim()).map((v) => [v.sku!.toLowerCase(), v]));
  
  const usedVariantIds = new Set<string>();
  const usedKeys = new Set<string>();
  const linksToUpsert: Array<{ brandIntegrationId: string; variantId: string; externalId: string; externalProductId: string; externalSku: string | null; externalBarcode: string | null; lastSyncedHash: string | null }> = [];
  const variantsToCreate: Array<{ colorId: string | null; sizeId: string | null; sku: string | null; barcode: string | null; linkData: { externalId: string; rawIds: { sku?: string; barcode?: string }; hash: string } }> = [];

  for (const externalVariant of externalProduct.variants) {
    const variantData = { ...externalVariant.data, product: externalProduct.data };
    const extracted = extractValues(variantData, mappings);
    const hash = computeHash(extracted);
    const rawIds = extractRawIdentifiers(variantData);
    const existingLink = preFetched.variantLinks.get(externalVariant.externalId);
    
    // FAST PATH: Hash matches = truly no changes, skip everything
    if (existingLink?.lastSyncedHash === hash) { 
      skipped++; 
      continue; 
    }

    const colorId = extracted.referenceEntities.colorName ? getCachedColor(caches, extracted.referenceEntities.colorName)?.id ?? null : null;
    const sizeId = extracted.referenceEntities.sizeName ? getCachedSize(caches, extracted.referenceEntities.sizeName)?.id ?? null : null;
    const sku = skuEnabled ? (extracted.variant.sku as string) ?? null : null;
    const barcode = barcodeEnabled ? (extracted.variant.barcode as string) ?? null : null;
    const key = makeKey(colorId, sizeId);

    const existingVariant = findExistingVariant(existingLink, existingById, existingByBarcode, existingBySku, existingByKey, rawIds, key, usedVariantIds, usedKeys, matchViaIdentifiers);

    if (existingVariant) {
      const updateData: Record<string, unknown> = {};
      if (existingVariant.colorId !== colorId) updateData.colorId = colorId;
      if (existingVariant.sizeId !== sizeId) updateData.sizeId = sizeId;
      if (skuEnabled && existingVariant.sku !== sku) updateData.sku = sku;
      if (barcodeEnabled && existingVariant.barcode !== barcode) updateData.barcode = barcode;
      
      if (Object.keys(updateData).length > 0) {
        await db.update(productVariants).set(updateData).where(eq(productVariants.id, existingVariant.id));
        updated++;
      } else { skipped++; }
      
      linksToUpsert.push({ brandIntegrationId: ctx.brandIntegrationId, variantId: existingVariant.id, externalId: externalVariant.externalId, externalProductId: externalProduct.externalId, externalSku: rawIds.sku ?? null, externalBarcode: rawIds.barcode ?? null, lastSyncedHash: hash });
    } else {
      variantsToCreate.push({ colorId, sizeId, sku, barcode, linkData: { externalId: externalVariant.externalId, rawIds, hash } });
      usedKeys.add(key);
    }
  }

  // Batch create new variants
  if (variantsToCreate.length > 0) {
    const upids = await generateUniqueUpids({
      count: variantsToCreate.length,
      isTaken: async (c) => { const [r] = await db.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.upid, c)).limit(1); return Boolean(r); },
      fetchTakenSet: async (candidates) => { const rows = await db.select({ upid: productVariants.upid }).from(productVariants).where(inArray(productVariants.upid, candidates as string[])); return new Set(rows.map((r) => r.upid).filter(Boolean) as string[]); },
    });

    const inserted = await db.insert(productVariants).values(variantsToCreate.map((v, i) => ({ productId, colorId: v.colorId, sizeId: v.sizeId, sku: v.sku, barcode: v.barcode, upid: upids[i]! }))).returning({ id: productVariants.id });

    for (let i = 0; i < inserted.length; i++) {
      const { linkData } = variantsToCreate[i]!;
      linksToUpsert.push({ brandIntegrationId: ctx.brandIntegrationId, variantId: inserted[i]!.id, externalId: linkData.externalId, externalProductId: externalProduct.externalId, externalSku: linkData.rawIds.sku ?? null, externalBarcode: linkData.rawIds.barcode ?? null, lastSyncedHash: linkData.hash });
    }
  }

  if (linksToUpsert.length) {
    await batchUpsertVariantLinks(db, linksToUpsert);
  }

  return { variantsCreated: variantsToCreate.length, variantsUpdated: updated, variantsSkipped: skipped };
}

/**
 * Finds existing variant using priority matching:
 * 1. Existing link (source of truth)
 * 2. Barcode match (if matchViaIdentifiers)
 * 3. SKU match (if matchViaIdentifiers)
 * 4. colorId:sizeId fallback (if key not used)
 */
function findExistingVariant<T extends { id: string }>(
  existingLink: { variantId: string } | undefined,
  existingById: Map<string, T>,
  existingByBarcode: Map<string, T>,
  existingBySku: Map<string, T>,
  existingByKey: Map<string, T>,
  rawIds: { sku?: string; barcode?: string },
  key: string,
  usedVariantIds: Set<string>,
  usedKeys: Set<string>,
  matchViaIdentifiers: boolean
): T | undefined {
  // Priority 1: Existing link
  if (existingLink) {
    const v = existingById.get(existingLink.variantId);
    if (v) { usedVariantIds.add(v.id); return v; }
  }

  // Priority 2 & 3: Barcode/SKU match (when no link exists)
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

  // Priority 4: colorId:sizeId fallback
  if (!usedKeys.has(key)) {
    const v = existingByKey.get(key);
    if (v && !usedVariantIds.has(v.id)) {
      usedVariantIds.add(v.id);
      usedKeys.add(key);
      return v;
    }
  }

  return undefined;
}

function makeKey(colorId: string | null, sizeId: string | null): string {
  return `${colorId ?? "null"}:${sizeId ?? "null"}`;
}
