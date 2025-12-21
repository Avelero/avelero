/**
 * Integration Sync Engine
 *
 * Product-centric sync with batch operations for optimal performance.
 * 
 * Architecture:
 * 1. Fetch products from connector in batches
 * 2. Process each product to compute pending operations (parallel, no DB writes)
 * 3. Execute all DB operations in batch (minimal queries)
 */

import type { Database } from "@v1/db/client";
import { 
  batchFindProductLinks, 
  batchFindVariantLinks, 
  batchFindVariantsByProductIds,
  batchUpdateProducts,
  batchUpdateVariants,
  batchSetProductTags,
  batchUpsertProductLinks,
  batchUpsertVariantLinks,
  type VariantUpdateData,
} from "@v1/db/queries/integrations";
import { productVariants } from "@v1/db/schema";
import { generateUniqueUpids } from "@v1/db/utils";
import { eq, inArray } from "@v1/db/queries";
import { getConnector } from "../connectors/registry";
import { buildEffectiveFieldMappings } from "./extractor";
import { initializeCaches, type SyncCaches } from "./caches";
import { createMissingEntities, extractUniqueEntitiesFromBatch } from "./batch-operations";
import { processProduct, type PendingOperations } from "./processor";
import type { FetchedProductBatch, SyncContext, SyncResult } from "./types";

const PRODUCT_CONCURRENCY = 10;
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

    for await (const batch of connector.fetchProducts(ctx.credentials)) {
      batchNumber++;
      const batchStart = Date.now();
      console.log(`[SYNC] Batch ${batchNumber}: Processing ${batch.length} products...`);

      const batchResult = await processBatch(db, ctx, batch, mappings, caches, onProductProcessed);

      const batchMs = Date.now() - batchStart;
      console.log(`[SYNC] Batch ${batchNumber}: Completed in ${batchMs}ms (created: ${batchResult.productsCreated}, updated: ${batchResult.productsUpdated}, variants: ${batchResult.variantsCreated}/${batchResult.variantsUpdated}/${batchResult.variantsSkipped} c/u/s)`);
      console.log(`[SYNC] Batch ${batchNumber} TIMING: entity=${batchResult.timing.entityExtraction}ms, prefetch=${batchResult.timing.preFetch}ms, compute=${batchResult.timing.compute}ms, batchOps=${batchResult.timing.batchOps}ms`);
      console.log(`[SYNC] Batch ${batchNumber} QUERIES: total=${batchResult.queries.total} (prefetch=${batchResult.queries.preFetch}, pUpdate=${batchResult.queries.productUpdates}, pLinks=${batchResult.queries.productLinks}, tags=${batchResult.queries.tags}, vUpdate=${batchResult.queries.variantUpdates}, vCreate=${batchResult.queries.variantCreates}, vLinks=${batchResult.queries.variantLinks})`);

      result.variantsProcessed += batchResult.variantsProcessed;
      result.variantsCreated += batchResult.variantsCreated;
      result.variantsUpdated += batchResult.variantsUpdated;
      result.variantsSkipped += batchResult.variantsSkipped;
      result.variantsFailed += batchResult.variantsFailed;
      result.productsCreated += batchResult.productsCreated;
      result.productsUpdated += batchResult.productsUpdated;
      result.entitiesCreated += batchResult.entitiesCreated;
      result.errors.push(...batchResult.errors);
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

interface BatchResult {
  variantsProcessed: number;
  variantsCreated: number;
  variantsUpdated: number;
  variantsSkipped: number;
  variantsFailed: number;
  productsCreated: number;
  productsUpdated: number;
  entitiesCreated: number;
  errors: Array<{ externalId: string; message: string }>;
  timing: {
    entityExtraction: number;
    preFetch: number;
    compute: number;
    batchOps: number;
  };
  queries: {
    preFetch: number;
    productUpdates: number;
    productLinks: number;
    tags: number;
    variantUpdates: number;
    variantCreates: number;
    variantLinks: number;
    total: number;
  };
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
    errors: [],
    timing: {
      entityExtraction: 0,
      preFetch: 0,
      compute: 0,
      batchOps: 0,
    },
    queries: {
      preFetch: 0,
      productUpdates: 0,
      productLinks: 0,
      tags: 0,
      variantUpdates: 0,
      variantCreates: 0,
      variantLinks: 0,
      total: 0,
    },
  };

  // PHASE 1: Extract and create missing entities (tags only - colors/sizes removed)
  const entityStart = Date.now();
  const extracted = extractUniqueEntitiesFromBatch(batch, mappings);
  const creationStats = await createMissingEntities(db, ctx.brandId, extracted, caches);
  result.entitiesCreated += creationStats.tagsCreated;
  result.timing.entityExtraction = Date.now() - entityStart;
  result.queries.preFetch += (creationStats.tagsCreated > 0 ? 1 : 0);

  // PHASE 2: Pre-fetch all links and variants
  const preFetchStart = Date.now();
  const [productLinks, variantLinks] = await Promise.all([
    batchFindProductLinks(db, ctx.brandIntegrationId, Array.from(extracted.productIds)),
    batchFindVariantLinks(db, ctx.brandIntegrationId, Array.from(extracted.variantIds)),
  ]);
  result.queries.preFetch += 2;

  const linkedProductIds = Array.from(productLinks.values()).map((l) => l.productId);
  const existingVariantsByProduct = await batchFindVariantsByProductIds(db, linkedProductIds);
  result.queries.preFetch += 1;
  result.timing.preFetch = Date.now() - preFetchStart;

  const preFetched = { productLinks, variantLinks, existingVariantsByProduct };

  // PHASE 3: Process all products to compute pending operations (parallel, minimal DB)
  const computeStart = Date.now();
  const semaphore = new Semaphore(PRODUCT_CONCURRENCY);
  
  // Collect all pending operations from all products
  const allPendingOps: PendingOperations = {
    productUpdates: [],
    productLinkUpserts: [],
    tagAssignments: [],
    variantUpdates: [],
    variantCreates: [],
    variantLinkUpserts: [],
  };

  await Promise.all(
    batch.map(async (product) => {
      await semaphore.acquire();
      try {
        const processed = await processProduct(db, ctx, product, mappings, caches, preFetched);
        result.variantsProcessed += product.variants.length;

        if (processed.success) {
          result.variantsCreated += processed.variantsCreated;
          result.variantsUpdated += processed.variantsUpdated;
          result.variantsSkipped += processed.variantsSkipped;
          if (processed.productCreated) result.productsCreated++;
          else if (processed.productUpdated) result.productsUpdated++;
          
          // Merge pending operations
          allPendingOps.productUpdates.push(...processed.pendingOps.productUpdates);
          allPendingOps.productLinkUpserts.push(...processed.pendingOps.productLinkUpserts);
          allPendingOps.tagAssignments.push(...processed.pendingOps.tagAssignments);
          allPendingOps.variantUpdates.push(...processed.pendingOps.variantUpdates);
          allPendingOps.variantCreates.push(...processed.pendingOps.variantCreates);
          allPendingOps.variantLinkUpserts.push(...processed.pendingOps.variantLinkUpserts);
        } else {
          result.variantsFailed += product.variants.length;
          result.errors.push({ externalId: product.externalId, message: processed.error || "Unknown error" });
        }

        if (onProductProcessed) {
          await onProductProcessed();
        }
      } finally {
        semaphore.release();
      }
    })
  );
  result.timing.compute = Date.now() - computeStart;

  // PHASE 4: Execute all batch operations
  const batchOpsStart = Date.now();
  
  // 4a: Batch update products
  if (allPendingOps.productUpdates.length > 0) {
    await batchUpdateProducts(db, allPendingOps.productUpdates);
    result.queries.productUpdates = 1; // All product updates in one batch
  }

  // 4b: Batch upsert product links
  if (allPendingOps.productLinkUpserts.length > 0) {
    await batchUpsertProductLinks(db, allPendingOps.productLinkUpserts);
    result.queries.productLinks = 1;
  }

  // 4c: Batch set tags
  if (allPendingOps.tagAssignments.length > 0) {
    await batchSetProductTags(db, allPendingOps.tagAssignments);
    result.queries.tags = 2; // 1 delete + 1 insert
  }

  // 4d: Batch update variants (TRUE BATCH - single query!)
  if (allPendingOps.variantUpdates.length > 0) {
    const variantUpdates: VariantUpdateData[] = allPendingOps.variantUpdates.map(u => ({
      id: u.id,
      sku: u.sku,
      barcode: u.barcode,
    }));
    await batchUpdateVariants(db, variantUpdates);
    result.queries.variantUpdates = 1; // Single batch query!
  }

  // 4e: Batch create variants
  if (allPendingOps.variantCreates.length > 0) {
    // Generate UPIDs for all new variants
    const upids = await generateUniqueUpids({
      count: allPendingOps.variantCreates.length,
      isTaken: async (c) => { 
        const [r] = await db.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.upid, c)).limit(1); 
        return Boolean(r); 
      },
      fetchTakenSet: async (candidates) => { 
        const rows = await db.select({ upid: productVariants.upid }).from(productVariants).where(inArray(productVariants.upid, candidates as string[])); 
        return new Set(rows.map((r) => r.upid).filter(Boolean) as string[]); 
      },
    });

    // Batch insert all variants (colorId/sizeId removed as part of variant attribute migration)
    const inserted = await db.insert(productVariants)
      .values(allPendingOps.variantCreates.map((v, i) => ({
        productId: v.productId,
        sku: v.sku,
        barcode: v.barcode,
        upid: upids[i]!,
      })))
      .returning({ id: productVariants.id });
    
    result.queries.variantCreates = 2; // 1 for UPID check + 1 for batch insert

    // Add variant links for newly created variants
    for (let i = 0; i < inserted.length; i++) {
      const create = allPendingOps.variantCreates[i]!;
      allPendingOps.variantLinkUpserts.push({
        brandIntegrationId: create.linkData.brandIntegrationId,
        variantId: inserted[i]!.id,
        externalId: create.linkData.externalId,
        externalProductId: create.linkData.externalProductId,
        externalSku: create.linkData.externalSku,
        externalBarcode: create.linkData.externalBarcode,
        lastSyncedHash: create.linkData.lastSyncedHash,
      });
    }
  }

  // 4f: Batch upsert variant links
  if (allPendingOps.variantLinkUpserts.length > 0) {
    await batchUpsertVariantLinks(db, allPendingOps.variantLinkUpserts);
    result.queries.variantLinks = 1;
  }

  result.timing.batchOps = Date.now() - batchOpsStart;
  result.queries.total = result.queries.preFetch + result.queries.productUpdates + result.queries.productLinks + 
    result.queries.tags + result.queries.variantUpdates + result.queries.variantCreates + result.queries.variantLinks;

  return result;
}

class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    return new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  release(): void {
    const next = this.waiting.shift();
    if (next) next();
    else this.permits++;
  }
}
