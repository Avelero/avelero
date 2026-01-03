/**
 * Integration Sync Engine
 *
 * Product-centric sync with batch operations for optimal performance.
 * 
 * Architecture:
 * 1. Fetch products from connector in batches
 * 2. Pre-fetch all lookup data in batch (identifier matches, existing handles)
 * 3. Process each product to compute pending operations (pure computation, no DB)
 * 4. Execute all DB operations in batch (minimal queries)
 */

import type { Database } from "@v1/db/client";
import {
  batchFindProductLinks,
  batchFindVariantLinks,
  batchFindVariantsByProductIds,
  batchFindProductsByIdentifiers,
  batchFindAllBrandVariants,
  batchFindProductsWithCanonicalLink,
  batchUpdateProducts,
  batchUpsertProductCommercial,
  batchUpdateVariants,
  batchSetProductTags,
  batchUpsertProductLinks,
  batchUpsertVariantLinks,
  batchReplaceVariantAttributes,
  batchUpsertVariantDisplayOverrides,
  batchUpsertVariantCommercial,
  type VariantUpdateData,
  type ProductIdentifierBatch,
} from "@v1/db/queries/integrations";
import { products, productVariants } from "@v1/db/schema";
import { generateUniqueUpids, slugifyProductName } from "@v1/db/utils";
import { eq, and, inArray } from "@v1/db/queries";
import {
  downloadAndUploadImage,
  isExternalImageUrl,
} from "@v1/supabase/utils/external-images";
import { getConnector } from "../connectors/registry";
import { initShopifyToAveleroCategoryMapping } from "../connectors/shopify/category-mappings";
import type {
  FetchedProductBatch,
  FetchedProduct,
  SyncContext,
  SyncResult,
  StorageClient,
} from "../types";
import { initializeCaches, type SyncCaches } from "./caches";
import { createMissingEntities, extractUniqueEntitiesFromBatch } from "./batch-operations";
import {
  processProduct,
  buildEffectiveFieldMappings,
  extractValues,
  getValueByPath,
  type PendingOperations,
  type ProductCreateOp,
} from "./processor";

const PROGRESS_UPDATE_INTERVAL = 5;

export async function syncProducts(ctx: SyncContext): Promise<SyncResult> {
  const syncStart = Date.now();
  console.log(`[SYNC] Starting sync for ${ctx.productsTotal} products...`);

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
    productsSkippedNoMatch: 0,
    variantsSkippedNoMatch: 0,
    errors: [],
  };

  let totalProductsProcessed = 0;
  let lastProgressUpdate = 0;
  let batchNumber = 0;

  const onProductProcessed = async () => {
    totalProductsProcessed++;
    if (ctx.onProgress && totalProductsProcessed - lastProgressUpdate >= PROGRESS_UPDATE_INTERVAL) {
      lastProgressUpdate = totalProductsProcessed;
      await ctx.onProgress({
        productsProcessed: totalProductsProcessed,
        productsTotal: ctx.productsTotal,
      });
    }
  };

  try {
    const connector = getConnector(ctx.integrationSlug);
    if (!connector) {
      throw new Error(`Unknown integration: ${ctx.integrationSlug}`);
    }

    const mappings = buildEffectiveFieldMappings(connector.schema, ctx.fieldConfigs);
    const db = ctx.db as Database;
    const caches = await initializeCaches(db, ctx.brandId);

    // Initialize category mapping (1 query, cached for entire sync run)
    if (ctx.integrationSlug === "shopify") {
      await initShopifyToAveleroCategoryMapping(db);
    }

    // Collect all image upload promises to await at end of job
    const imageUploadPromises: Promise<{ completed: number; failed: number }>[] = [];

    for await (const batch of connector.fetchProducts(ctx.credentials)) {
      batchNumber++;
      const batchStart = Date.now();
      console.log(`[SYNC] Batch ${batchNumber}: Processing ${batch.length} products...`);

      const batchResult = await processBatch(db, ctx, batch, mappings, caches, onProductProcessed);

      // Collect image upload promise (will be awaited at job end)
      if (batchResult.imageUploadPromise) {
        imageUploadPromises.push(batchResult.imageUploadPromise);
      }

      const batchMs = Date.now() - batchStart;
      console.log(`[SYNC] Batch ${batchNumber}: Completed in ${batchMs}ms (created: ${batchResult.productsCreated}, updated: ${batchResult.productsUpdated}, variants: ${batchResult.variantsCreated}/${batchResult.variantsUpdated}/${batchResult.variantsSkipped} c/u/s)`);
      console.log(`[SYNC] Batch ${batchNumber} TIMING: entity=${batchResult.timing.entityExtraction}ms, prefetch=${batchResult.timing.preFetch}ms, compute=${batchResult.timing.compute}ms, batchOps=${batchResult.timing.batchOps}ms`);
      console.log(`[SYNC] Batch ${batchNumber} QUERIES: total=${batchResult.queries.total} (prefetch=${batchResult.queries.preFetch}, batch: pCreate=${batchResult.queries.productCreates}, pUpdate=${batchResult.queries.productUpdates}, pCommercial=${batchResult.queries.productCommercial}, pLinks=${batchResult.queries.productLinks}, tags=${batchResult.queries.tags}, vUpdate=${batchResult.queries.variantUpdates}, vCreate=${batchResult.queries.variantCreates}, vLinks=${batchResult.queries.variantLinks}, vAttrs=${batchResult.queries.variantAttributes})`);

      result.variantsProcessed += batchResult.variantsProcessed;
      result.variantsCreated += batchResult.variantsCreated;
      result.variantsUpdated += batchResult.variantsUpdated;
      result.variantsSkipped += batchResult.variantsSkipped;
      result.variantsFailed += batchResult.variantsFailed;
      result.productsCreated += batchResult.productsCreated;
      result.productsUpdated += batchResult.productsUpdated;
      result.entitiesCreated += batchResult.entitiesCreated;
      result.productsSkippedNoMatch += batchResult.productsSkippedNoMatch;
      result.variantsSkippedNoMatch += batchResult.variantsSkippedNoMatch;
      result.errors.push(...batchResult.errors);
    }

    // Wait for all image uploads to complete before marking job as done
    if (imageUploadPromises.length > 0) {
      console.log(`[SYNC] Waiting for ${imageUploadPromises.length} batch image uploads to complete...`);
      const imageStart = Date.now();
      const imageResults = await Promise.all(imageUploadPromises);
      const totalCompleted = imageResults.reduce((sum, r) => sum + r.completed, 0);
      const totalFailed = imageResults.reduce((sum, r) => sum + r.failed, 0);
      console.log(`[SYNC] All image uploads finished in ${Date.now() - imageStart}ms: ${totalCompleted} succeeded, ${totalFailed} failed`);
    }

    if (ctx.onProgress && totalProductsProcessed > lastProgressUpdate) {
      await ctx.onProgress({
        productsProcessed: totalProductsProcessed,
        productsTotal: ctx.productsTotal,
      });
    }

    result.success = result.variantsFailed === 0 && result.errors.length === 0;
    console.log(`[SYNC] Completed in ${Date.now() - syncStart}ms - Products: ${result.productsCreated} created, ${result.productsUpdated} updated | Variants: ${result.variantsCreated} created, ${result.variantsUpdated} updated, ${result.variantsSkipped} skipped`);
  } catch (error) {
    console.log(`[SYNC] Failed after ${Date.now() - syncStart}ms: ${error instanceof Error ? error.message : String(error)}`);
    result.errors.push({
      externalId: "SYSTEM",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return result;
}

export async function testIntegrationConnection(
  integrationSlug: string,
  credentials: SyncContext["credentials"]
): Promise<{ success: boolean; message: string; data?: unknown }> {
  const connector = getConnector(integrationSlug);
  if (!connector) {
    return { success: false, message: `Unknown integration: ${integrationSlug}` };
  }

  try {
    const result = await connector.testConnection(credentials);
    return { success: true, message: "Connection successful", data: result };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : String(error) };
  }
}

// =============================================================================
// BATCH PROCESSING
// =============================================================================

interface BatchResult {
  variantsProcessed: number;
  variantsCreated: number;
  variantsUpdated: number;
  variantsSkipped: number;
  variantsFailed: number;
  productsCreated: number;
  productsUpdated: number;
  entitiesCreated: number;
  /** Products skipped because no match found (secondary integrations only) */
  productsSkippedNoMatch: number;
  /** Variants skipped because no match found (secondary integrations only) */
  variantsSkippedNoMatch: number;
  errors: Array<{ externalId: string; message: string }>;
  timing: {
    entityExtraction: number;
    preFetch: number;
    compute: number;
    batchOps: number;
  };
  queries: {
    preFetch: number;
    productCreates: number;
    productUpdates: number;
    productCommercial: number;
    productLinks: number;
    tags: number;
    variantUpdates: number;
    variantCreates: number;
    variantLinks: number;
    variantAttributes: number;
    total: number;
  };
  imageUploadPromise: Promise<{ completed: number; failed: number }> | null;
}

async function processBatch(
  db: Database,
  ctx: SyncContext,
  batch: FetchedProductBatch,
  mappings: ReturnType<typeof buildEffectiveFieldMappings>,
  caches: SyncCaches,
  onProductProcessed?: () => Promise<void>
): Promise<BatchResult> {
  const result: BatchResult = {
    variantsProcessed: 0,
    variantsCreated: 0,
    variantsUpdated: 0,
    variantsSkipped: 0,
    variantsFailed: 0,
    productsCreated: 0,
    productsUpdated: 0,
    entitiesCreated: 0,
    productsSkippedNoMatch: 0,
    variantsSkippedNoMatch: 0,
    errors: [],
    timing: {
      entityExtraction: 0,
      preFetch: 0,
      compute: 0,
      batchOps: 0,
    },
    queries: {
      preFetch: 0,
      productCreates: 0,
      productUpdates: 0,
      productCommercial: 0,
      productLinks: 0,
      tags: 0,
      variantUpdates: 0,
      variantCreates: 0,
      variantLinks: 0,
      variantAttributes: 0,
      total: 0,
    },
    imageUploadPromise: null,
  };

  // PHASE 1: Extract and create missing entities (tags only - colors/sizes removed)
  const entityStart = Date.now();
  const extracted = extractUniqueEntitiesFromBatch(batch, mappings);
  // Pass isPrimary to control whether attributes can be created (only primary can create)
  const creationStats = await createMissingEntities(db, ctx.brandId, extracted, caches, ctx.isPrimary);
  result.entitiesCreated += creationStats.tagsCreated;
  result.timing.entityExtraction = Date.now() - entityStart;
  result.queries.preFetch += (creationStats.tagsCreated > 0 ? 1 : 0);

  // PHASE 2: Pre-fetch all links, variants, AND identifier matches (BATCHED)
  const preFetchStart = Date.now();

  // 2a: Fetch existing product/variant links
  const [productLinks, variantLinks] = await Promise.all([
    batchFindProductLinks(db, ctx.brandIntegrationId, Array.from(extracted.productIds)),
    batchFindVariantLinks(db, ctx.brandIntegrationId, Array.from(extracted.variantIds)),
  ]);
  result.queries.preFetch += 2;

  // 2b: Identify products that need identifier matching (no existing link)
  const productsNeedingMatch: ProductIdentifierBatch[] = [];
  for (const product of batch) {
    if (!productLinks.has(product.externalId)) {
      // Extract variant identifiers for matching
      const identifiers = product.variants.map((v: FetchedProduct["variants"][number]) => {
        const variantData = { ...v.data, product: product.data };
        return extractRawIdentifiers(variantData);
      });
      productsNeedingMatch.push({ externalId: product.externalId, identifiers });
    }
  }

  // 2c: Batch identifier matching (replaces N individual findProductByVariantIdentifiers calls)
  // Only secondary integrations do identifier matching, and they only use their configured identifier type
  let identifierMatches = new Map<string, { productId: string; productHandle: string }>();
  if (productsNeedingMatch.length > 0 && !ctx.isPrimary) {
    const matchResult = await batchFindProductsByIdentifiers(db, ctx.brandId, productsNeedingMatch, ctx.matchIdentifier);
    identifierMatches = matchResult.matches;
    result.queries.preFetch += 1; // Now only 1 query (barcode OR SKU, not both)
  }

  // 2d: Fetch existing variants for linked products
  const linkedProductIds = Array.from(productLinks.values()).map((l) => l.productId);
  // Also include products matched by identifiers
  for (const match of identifierMatches.values()) {
    if (!linkedProductIds.includes(match.productId)) {
      linkedProductIds.push(match.productId);
    }
  }
  const existingVariantsByProduct = await batchFindVariantsByProductIds(db, linkedProductIds);
  result.queries.preFetch += 1;

  // 2e: Batch check which handles are taken (replaces N individual isTaken calls)
  const productsNeedingHandles = batch.filter(
    (p: FetchedProduct) => !productLinks.has(p.externalId) && !identifierMatches.has(p.externalId)
  );
  const takenHandles = await batchCheckHandlesTaken(db, ctx.brandId, productsNeedingHandles, mappings);
  result.queries.preFetch += 1;

  // 2f: Build global variant index for multi-source integration matching
  // This enables matching variants across ALL products in the brand, not just linked ones
  const globalVariantIndex = await batchFindAllBrandVariants(db, ctx.brandId);
  result.queries.preFetch += 1;

  // 2g: Find which products already have a canonical link from this integration (multi-source support)
  // This is used to determine if new links should be canonical or non-canonical
  const productsWithCanonicalLink = await batchFindProductsWithCanonicalLink(
    db,
    ctx.brandIntegrationId,
    linkedProductIds
  );
  result.queries.preFetch += 1;

  result.timing.preFetch = Date.now() - preFetchStart;

  const preFetched = {
    productLinks,
    variantLinks,
    existingVariantsByProduct,
    identifierMatches,
    takenHandles,
    globalVariantIndex,
    productsWithCanonicalLink,
  };

  // PHASE 3: Process all products to compute pending operations (pure computation, NO DB!)
  const computeStart = Date.now();

  // Collect all pending operations from all products
  const allPendingOps: PendingOperations = {
    productCreates: [],
    productUpdates: [],
    productCommercialUpserts: [],
    productLinkUpserts: [],
    tagAssignments: [],
    variantUpdates: [],
    variantCreates: [],
    variantLinkUpserts: [],
    variantAttributeAssignments: [],
    variantDisplayOverrides: [],
    variantCommercialOverrides: [],
  };

  // Track handles used within this batch to avoid collisions
  const usedHandlesInBatch = new Set<string>();

  // Track products that have been assigned a canonical link within THIS batch
  // This prevents multiple products in the same batch from all being marked as canonical
  const productsWithCanonicalLinkInBatch = new Set<string>();

  for (const product of batch) {
    try {
      const processed = processProduct(ctx, product, mappings, caches, preFetched, usedHandlesInBatch, productsWithCanonicalLinkInBatch);
      result.variantsProcessed += product.variants.length;

      if (processed.success) {
        result.variantsCreated += processed.variantsCreated;
        result.variantsUpdated += processed.variantsUpdated;
        result.variantsSkipped += processed.variantsSkipped;
        if (processed.productCreated) result.productsCreated++;
        else if (processed.productUpdated) result.productsUpdated++;

        // Track secondary integration skips
        if (processed.productSkippedNoMatch) result.productsSkippedNoMatch++;
        result.variantsSkippedNoMatch += processed.variantsSkippedNoMatch;

        // Merge pending operations
        if (processed.pendingOps.productCreate) {
          allPendingOps.productCreates.push(processed.pendingOps.productCreate);
        }
        allPendingOps.productUpdates.push(...processed.pendingOps.productUpdates);
        allPendingOps.productCommercialUpserts.push(...processed.pendingOps.productCommercialUpserts);
        allPendingOps.productLinkUpserts.push(...processed.pendingOps.productLinkUpserts);
        allPendingOps.tagAssignments.push(...processed.pendingOps.tagAssignments);
        allPendingOps.variantUpdates.push(...processed.pendingOps.variantUpdates);
        allPendingOps.variantCreates.push(...processed.pendingOps.variantCreates);
        allPendingOps.variantLinkUpserts.push(...processed.pendingOps.variantLinkUpserts);
        allPendingOps.variantAttributeAssignments.push(...processed.pendingOps.variantAttributeAssignments);
        allPendingOps.variantDisplayOverrides.push(...processed.pendingOps.variantDisplayOverrides);
        allPendingOps.variantCommercialOverrides.push(...processed.pendingOps.variantCommercialOverrides);
      } else {
        result.variantsFailed += product.variants.length;
        result.errors.push({ externalId: product.externalId, message: processed.error || "Unknown error" });
      }

      if (onProductProcessed) {
        await onProductProcessed();
      }
    } catch (error) {
      result.variantsFailed += product.variants.length;
      result.errors.push({
        externalId: product.externalId,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
  result.timing.compute = Date.now() - computeStart;

  // PHASE 4: Execute all batch operations (PARALLELIZED where possible)
  const batchOpsStart = Date.now();

  // Collect image upload tasks for rate-limited execution
  const imageUploadTasks: Array<{ productId: string; imageUrl: string }> = [];
  const variantImageUploadTasks: Array<{ variantId: string; imageUrl: string }> = [];

  // GROUP 1: Product creates (must be first - generates IDs)
  const createdProductMap = new Map<string, string>(); // externalId -> productId
  if (allPendingOps.productCreates.length > 0) {
    // Validate handles using pre-fetched takenHandles (no N+1 queries)
    const handlesInBatch = new Set<string>();
    for (const create of allPendingOps.productCreates) {
      let handle = create.productHandle;
      let attempts = 0;
      const maxAttempts = 10;

      // Check against batch-prefetched takenHandles and handles used in this batch
      while (attempts < maxAttempts) {
        const isTakenInDb = preFetched.takenHandles.has(handle);
        const isTakenInBatch = handlesInBatch.has(handle);

        if (!isTakenInDb && !isTakenInBatch) {
          break; // Handle is unique
        }

        // Generate a new handle with suffix
        handle = `${create.productHandle}-${Date.now().toString(36)}${attempts}`;
        attempts++;
      }

      // Update the create op with the verified unique handle
      create.productHandle = handle;
      handlesInBatch.add(handle);
      // Also add to takenHandles so subsequent batches see it
      preFetched.takenHandles.add(handle);
    }

    const insertedProducts = await db.insert(products)
      .values(allPendingOps.productCreates.map((p: ProductCreateOp) => ({
        brandId: ctx.brandId,
        name: p.name,
        productHandle: p.productHandle,
        description: p.description,
        imagePath: null,
        status: "unpublished" as const,
        categoryId: p.categoryId,
        source: p.source,
        sourceIntegrationId: p.sourceIntegrationId,
      })))
      .returning({ id: products.id, productHandle: products.productHandle });

    result.queries.productCreates = 1;

    // Map external IDs to created product IDs and collect image uploads
    for (let i = 0; i < insertedProducts.length; i++) {
      const create = allPendingOps.productCreates[i]!;
      const inserted = insertedProducts[i]!;
      createdProductMap.set(create.externalId, inserted.id);

      // Queue image upload for later (rate-limited)
      if (create.imageUrl) {
        imageUploadTasks.push({ productId: inserted.id, imageUrl: create.imageUrl });
      }
    }

    // Update pending ops that reference newly created products
    updatePendingOpsWithCreatedProducts(allPendingOps, createdProductMap);
  }

  // GROUP 2: Product updates, commercial, links, tags, variant updates (SEQUENTIAL to avoid deadlocks)
  if (allPendingOps.productUpdates.length > 0) {
    await batchUpdateProducts(db, allPendingOps.productUpdates);
    result.queries.productUpdates = 1;
  }

  if (allPendingOps.productCommercialUpserts.length > 0) {
    await batchUpsertProductCommercial(db, allPendingOps.productCommercialUpserts);
    result.queries.productCommercial = 1;
  }

  if (allPendingOps.productLinkUpserts.length > 0) {
    await batchUpsertProductLinks(db, allPendingOps.productLinkUpserts);
    result.queries.productLinks = 1;
  }

  if (allPendingOps.tagAssignments.length > 0) {
    await batchSetProductTags(db, allPendingOps.tagAssignments);
    result.queries.tags = 2;
  }

  if (allPendingOps.variantUpdates.length > 0) {
    const variantUpdates: VariantUpdateData[] = allPendingOps.variantUpdates.map((u: PendingOperations["variantUpdates"][number]) => ({
      id: u.id,
      sku: u.sku,
      barcode: u.barcode,
    }));
    await batchUpdateVariants(db, variantUpdates);
    result.queries.variantUpdates = 1;
  }

  // GROUP 3: Variant creates (generates variant IDs, populates link/attr queues)
  if (allPendingOps.variantCreates.length > 0) {
    const variantCreates = allPendingOps.variantCreates;

    // Generate UPIDs for all new variants
    const upids = await generateUniqueUpids({
      count: variantCreates.length,
      isTaken: async (c) => {
        const [r] = await db.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.upid, c)).limit(1);
        return Boolean(r);
      },
      fetchTakenSet: async (candidates) => {
        const rows = await db.select({ upid: productVariants.upid }).from(productVariants).where(inArray(productVariants.upid, candidates as string[]));
        return new Set(rows.map((r) => r.upid).filter(Boolean) as string[]);
      },
    });

    // Batch insert all variants
    const inserted = await db.insert(productVariants)
      .values(variantCreates.map((v: PendingOperations["variantCreates"][number], i: number) => ({
        productId: v.productId,
        sku: v.sku,
        barcode: v.barcode,
        upid: upids[i]!,
      })))
      .returning({ id: productVariants.id });

    result.queries.variantCreates = 2;

    // Add variant links and attribute assignments for newly created variants
    for (let i = 0; i < inserted.length; i++) {
      const create = variantCreates[i]!;
      const variantId = inserted[i]!.id;

      allPendingOps.variantLinkUpserts.push({
        brandIntegrationId: create.linkData.brandIntegrationId,
        variantId,
        externalId: create.linkData.externalId,
        externalProductId: create.linkData.externalProductId,
        externalSku: create.linkData.externalSku,
        externalBarcode: create.linkData.externalBarcode,
        lastSyncedHash: create.linkData.lastSyncedHash,
      });

      if (create.attributeValueIds.length > 0) {
        allPendingOps.variantAttributeAssignments.push({
          variantId,
          attributeValueIds: create.attributeValueIds,
        });
      }
    }
  }

  // GROUP 4: Variant links and attributes (SEQUENTIAL to avoid deadlocks)
  if (allPendingOps.variantLinkUpserts.length > 0) {
    await batchUpsertVariantLinks(db, allPendingOps.variantLinkUpserts);
    result.queries.variantLinks = 1;
  }

  if (allPendingOps.variantAttributeAssignments.length > 0) {
    await batchReplaceVariantAttributes(db, allPendingOps.variantAttributeAssignments);
    result.queries.variantAttributes = 2;
  }

  // GROUP 5: Variant display overrides (multi-source integration support)
  // These are written for non-canonical source products in many-to-one mappings
  if (allPendingOps.variantDisplayOverrides.length > 0) {
    // Extract image URLs for async processing (like product images)
    for (const override of allPendingOps.variantDisplayOverrides) {
      if (override.imagePath && isExternalImageUrl(override.imagePath)) {
        variantImageUploadTasks.push({
          variantId: override.variantId,
          imageUrl: override.imagePath,
        });
        // Clear imagePath - will be set after async upload
        override.imagePath = null;
      }
    }
    await batchUpsertVariantDisplayOverrides(db, allPendingOps.variantDisplayOverrides);
    result.queries.variantUpdates += 1; // Reuse variantUpdates counter for display overrides
  }

  // GROUP 6: Variant commercial overrides (multi-source integration support)
  // These are written for non-canonical source products with differing prices
  if (allPendingOps.variantCommercialOverrides.length > 0) {
    await batchUpsertVariantCommercial(db, allPendingOps.variantCommercialOverrides);
    result.queries.variantUpdates += 1; // Reuse variantUpdates counter for commercial overrides
  }

  result.timing.batchOps = Date.now() - batchOpsStart;

  // PHASE 5: Start image uploads (fire-and-forget at batch level, awaited at job level)
  // Process both product and variant images
  if (imageUploadTasks.length > 0 || variantImageUploadTasks.length > 0) {
    result.imageUploadPromise = processImagesWithRateLimit(
      ctx.storageClient,
      ctx.brandId,
      db,
      imageUploadTasks,
      variantImageUploadTasks,
      25
    );
  }

  // Calculate total queries: preFetch + batch
  const batchTotal = result.queries.productCreates + result.queries.productUpdates + result.queries.productCommercial +
    result.queries.productLinks + result.queries.tags + result.queries.variantUpdates + result.queries.variantCreates +
    result.queries.variantLinks + result.queries.variantAttributes;
  result.queries.total = result.queries.preFetch + batchTotal;

  return result;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

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

/**
 * Batch check which product handles are already taken.
 * Returns a Set of taken handles for quick lookup.
 */
async function batchCheckHandlesTaken(
  db: Database,
  brandId: string,
  productsToCheck: FetchedProduct[],
  mappings: ReturnType<typeof buildEffectiveFieldMappings>
): Promise<Set<string>> {
  if (productsToCheck.length === 0) {
    return new Set();
  }

  // Generate base slugs for all products
  const baseSlugs = new Set<string>();
  for (const product of productsToCheck) {
    const productExtracted = extractValues(product.data, mappings);
    const productName = (productExtracted.product.name as string) || "Unnamed Product";
    const baseSlug = slugifyProductName(productName);
    if (baseSlug) {
      baseSlugs.add(baseSlug);
    }
  }

  if (baseSlugs.size === 0) {
    return new Set();
  }

  // Query for all handles that start with any of our base slugs
  const rows = await db
    .select({ handle: products.productHandle })
    .from(products)
    .where(and(
      eq(products.brandId, brandId),
      inArray(products.productHandle, Array.from(baseSlugs))
    ));

  const takenHandles = new Set(rows.map((r) => r.handle));

  return takenHandles;
}

/**
 * Update pending operations that reference newly created products.
 * Replaces placeholder externalIds with actual product IDs.
 */
function updatePendingOpsWithCreatedProducts(
  pendingOps: PendingOperations,
  createdProductMap: Map<string, string>
): void {
  // Update product commercial upserts
  for (const commercial of pendingOps.productCommercialUpserts) {
    if (commercial.productId.startsWith("__pending:")) {
      const externalId = commercial.productId.replace("__pending:", "");
      const productId = createdProductMap.get(externalId);
      if (productId) {
        commercial.productId = productId;
      }
    }
  }

  // Update product link upserts
  for (const link of pendingOps.productLinkUpserts) {
    if (link.productId.startsWith("__pending:")) {
      const externalId = link.productId.replace("__pending:", "");
      const productId = createdProductMap.get(externalId);
      if (productId) {
        link.productId = productId;
      }
    }
  }

  // Update tag assignments
  for (const tag of pendingOps.tagAssignments) {
    if (tag.productId.startsWith("__pending:")) {
      const externalId = tag.productId.replace("__pending:", "");
      const productId = createdProductMap.get(externalId);
      if (productId) {
        tag.productId = productId;
      }
    }
  }

  // Update variant creates
  for (const variant of pendingOps.variantCreates) {
    if (variant.productId.startsWith("__pending:")) {
      const externalId = variant.productId.replace("__pending:", "");
      const productId = createdProductMap.get(externalId);
      if (productId) {
        variant.productId = productId;
      }
    }
  }
}

// =============================================================================
// IMAGE PROCESSING (inlined from matcher.ts)
// =============================================================================

/**
 * Download external image and upload to storage if needed.
 * Returns the storage path, or null if download fails.
 * If the URL is already a storage path (not external), returns it unchanged.
 */
async function processImageUrl(
  storageClient: StorageClient,
  brandId: string,
  productId: string,
  imageUrl: string | null | undefined
): Promise<string | null> {
  if (!imageUrl) return null;

  // If not an external URL, return as-is (already a storage path)
  if (!isExternalImageUrl(imageUrl)) return imageUrl;

  // Download and upload to our storage
  const storagePath = await downloadAndUploadImage(storageClient, {
    url: imageUrl,
    bucket: "products",
    pathPrefix: brandId,
  });

  return storagePath;
}

/**
 * Download external image for a variant and upload to storage.
 * Uses a different path prefix to organize variant images separately.
 * Returns the storage path, or null if download fails.
 */
async function processVariantImageUrl(
  storageClient: StorageClient,
  brandId: string,
  variantId: string,
  imageUrl: string | null | undefined
): Promise<string | null> {
  if (!imageUrl) return null;

  // If not an external URL, return as-is (already a storage path)
  if (!isExternalImageUrl(imageUrl)) return imageUrl;

  // Download and upload to our storage with variants path prefix
  const storagePath = await downloadAndUploadImage(storageClient, {
    url: imageUrl,
    bucket: "products",
    pathPrefix: `${brandId}/variants`,
  });

  return storagePath;
}


/**
 * Process image uploads with rate limiting to avoid overwhelming external services.
 * Returns a Promise that resolves when all images are uploaded.
 * 
 * Handles both product images and variant images (for multi-source overrides).
 * Each image has a 120-second timeout to prevent hanging.
 */
function processImagesWithRateLimit(
  storageClient: StorageClient,
  brandId: string,
  db: Database,
  productTasks: Array<{ productId: string; imageUrl: string }>,
  variantTasks: Array<{ variantId: string; imageUrl: string }>,
  concurrency: number
): Promise<{ completed: number; failed: number }> {
  // Combine all tasks into a unified list
  type ImageTask =
    | { type: 'product'; productId: string; imageUrl: string }
    | { type: 'variant'; variantId: string; imageUrl: string };

  const allTasks: ImageTask[] = [
    ...productTasks.map(t => ({ type: 'product' as const, ...t })),
    ...variantTasks.map(t => ({ type: 'variant' as const, ...t })),
  ];

  if (allTasks.length === 0) {
    return Promise.resolve({ completed: 0, failed: 0 });
  }

  console.log(`[SYNC] Starting image upload for ${allTasks.length} images (${productTasks.length} products, ${variantTasks.length} variants, concurrency: ${concurrency})`);

  return new Promise((resolve) => {
    let currentIndex = 0;
    let completedCount = 0;
    let failedCount = 0;

    const checkDone = () => {
      if (completedCount + failedCount === allTasks.length) {
        console.log(`[SYNC] Image upload finished: ${completedCount} succeeded, ${failedCount} failed`);
        resolve({ completed: completedCount, failed: failedCount });
      }
    };

    const processNext = () => {
      if (currentIndex >= allTasks.length) return;

      const task = allTasks[currentIndex++]!;

      // Process with timeout (120s to handle large images and slow networks)
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Image upload timeout')), 120_000)
      );

      const uploadPromise = (async () => {
        if (task.type === 'product') {
          const path = await processImageUrl(storageClient, brandId, task.productId, task.imageUrl);
          if (path) {
            await db.update(products).set({ imagePath: path }).where(eq(products.id, task.productId));
          }
          return path;
        }
        // Variant image - use variants path prefix
        const path = await processVariantImageUrl(storageClient, brandId, task.variantId, task.imageUrl);
        if (path) {
          await db.update(productVariants).set({ imagePath: path }).where(eq(productVariants.id, task.variantId));
        }
        return path;
      })();

      Promise.race([uploadPromise, timeoutPromise])
        .then(() => {
          completedCount++;
        })
        .catch(() => {
          failedCount++;
        })
        .finally(() => {
          // Start next task or check if done
          if (currentIndex < allTasks.length) {
            processNext();
          }
          checkDone();
        });
    };

    // Start initial batch (up to concurrency limit)
    const initialBatch = Math.min(concurrency, allTasks.length);
    for (let i = 0; i < initialBatch; i++) {
      processNext();
    }
  });
}
