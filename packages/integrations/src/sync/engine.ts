/**
 * Integration Sync Engine
 *
 * Product-centric sync: products are fetched with nested variants.
 */

import type { Database } from "@v1/db/client";
import { batchFindProductLinks, batchFindVariantLinks, batchFindVariantsByProductIds } from "@v1/db/queries/integrations";
import { getConnector } from "../connectors/registry";
import { buildEffectiveFieldMappings } from "./extractor";
import { initializeCaches, type SyncCaches } from "./caches";
import { createMissingEntities, extractUniqueEntitiesFromBatch } from "./batch-operations";
import { processProduct } from "./processor";
import type { FetchedProductBatch, SyncContext, SyncResult } from "./types";

const PRODUCT_CONCURRENCY = 50;
const PROGRESS_UPDATE_INTERVAL = 5; // Update progress every N products

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

  // Shared counter for progress tracking across all batches
  let totalProductsProcessed = 0;
  let lastProgressUpdate = 0;
  let batchNumber = 0;

  // Progress callback that fires after each product
  const onProductProcessed = async () => {
    totalProductsProcessed++;
    // Update every N products to avoid too many DB writes
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

      console.log(`[SYNC] Batch ${batchNumber}: Completed in ${Date.now() - batchStart}ms (created: ${batchResult.productsCreated}, updated: ${batchResult.productsUpdated}, variants: ${batchResult.variantsCreated}/${batchResult.variantsUpdated}/${batchResult.variantsSkipped} c/u/s)`);

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

    // Final progress update to ensure we report 100%
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
  };

  // Extract and create missing entities
  const extracted = extractUniqueEntitiesFromBatch(batch, mappings);
  const creationStats = await createMissingEntities(db, ctx.brandId, extracted, caches);
  result.entitiesCreated += creationStats.colorsCreated + creationStats.sizesCreated + creationStats.tagsCreated;

  // Pre-fetch links and variants
  const [productLinks, variantLinks] = await Promise.all([
    batchFindProductLinks(db, ctx.brandIntegrationId, Array.from(extracted.productIds)),
    batchFindVariantLinks(db, ctx.brandIntegrationId, Array.from(extracted.variantIds)),
  ]);

  const linkedProductIds = Array.from(productLinks.values()).map((l) => l.productId);
  const existingVariantsByProduct = await batchFindVariantsByProductIds(db, linkedProductIds);

  const preFetched = { productLinks, variantLinks, existingVariantsByProduct };

  // Process products with concurrency limit
  const semaphore = new Semaphore(PRODUCT_CONCURRENCY);

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
