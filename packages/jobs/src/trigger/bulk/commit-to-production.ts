/**
 * Commit to Production Job (Refactored with Batch Operations)
 *
 * Phase 2 of the bulk import process:
 * 1. Pre-fetches ALL staging data for the job
 * 2. Processes images (downloads external URLs, uploads to storage)
 * 3. Executes all DB operations in batches for optimal performance
 * 4. Updates per-row status to COMMITTED or FAILED
 * 5. Deletes only COMMITTED rows (keeps FAILED for correction export)
 * 6. Revalidates DPP cache for the brand
 *
 * Key optimizations:
 * - Batch operations using sync-batch-operations (same as integrations)
 * - Rate-limited parallel image processing
 * - Minimal database round-trips
 * - Smart image change detection to prevent unnecessary re-downloads
 *
 * @module commit-to-production
 */

import "../configure-trigger";
import { createHash } from "node:crypto";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import { logger, task } from "@trigger.dev/sdk/v3";
import { type Database, serviceDb as db } from "@v1/db/client";
import { and, eq, inArray, sql } from "@v1/db/queries";
import * as schema from "@v1/db/schema";
import { generateUniqueUpids } from "@v1/db/utils";
import {
  downloadAndUploadImage,
  isExternalImageUrl,
} from "@v1/supabase/utils/external-images";
import { revalidateBrand } from "../../lib/dpp-revalidation";

// ============================================================================
// Types
// ============================================================================

interface CommitToProductionPayload {
  jobId: string;
  brandId: string;
}

interface CommitStats {
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  tagsSet: number;
  attributesSet: number;
  materialsSet: number;
  ecoClaimsSet: number;
  environmentSet: number;
  journeyStepsSet: number;
  weightSet: number;
  imagesProcessed: number;
  imagesFailed: number;
}

/** Image upload task for rate-limited processing */
interface ImageUploadTask {
  type: "product" | "variant";
  entityId: string;
  imageUrl: string;
}

/** Aggregated staging data for a product */
interface StagingProductData {
  stagingId: string;
  rowNumber: number;
  action: string;
  existingProductId: string | null;
  id: string;
  brandId: string;
  name: string;
  description: string | null;
  manufacturerId: string | null;
  imagePath: string | null;
  categoryId: string | null;
  seasonId: string | null;
  productHandle: string | null;
  status: string | null;
  variants: StagingVariantData[];
  tags: { tagId: string }[];
  // Product-level environmental/supply chain data (from parent row)
  materials: { brandMaterialId: string; percentage: string | null }[];
  ecoClaims: { ecoClaimId: string }[];
  environment: {
    carbonKgCo2E: string | null;
    waterLiters: string | null;
  } | null;
  journeySteps: { sortIndex: number; stepType: string; facilityId: string }[];
  weight: { weight: string | null; weightUnit: string | null } | null;
}

interface StagingVariantData {
  stagingId: string;
  rowNumber: number;
  action: string;
  existingVariantId: string | null;
  id: string;
  productId: string;
  upid: string | null;
  barcode: string | null;
  sku: string | null;
  nameOverride: string | null;
  descriptionOverride: string | null;
  imagePathOverride: string | null;
  attributes: {
    attributeId: string;
    attributeValueId: string;
    sortOrder: number;
  }[];
  materials: { brandMaterialId: string; percentage: string | null }[];
  ecoClaims: { ecoClaimId: string }[];
  environment: {
    carbonKgCo2e: string | null;
    waterLiters: string | null;
  } | null;
  journeySteps: { sortIndex: number; stepType: string; facilityId: string }[];
  weight: { weight: string | null; weightUnit: string | null } | null;
}

// ============================================================================
// Schema References
// ============================================================================

const {
  importJobs,
  stagingProducts,
  stagingProductVariants,
  stagingVariantAttributes,
  stagingProductTags,
  // Product-level staging tables
  stagingProductMaterials,
  stagingProductEcoClaims,
  stagingProductEnvironment,
  stagingProductJourneySteps,
  stagingProductWeight,
  // Variant-level staging tables (for overrides)
  stagingVariantMaterials,
  stagingVariantEcoClaims,
  stagingVariantEnvironment,
  stagingVariantJourneySteps,
  stagingVariantWeight,
  // Production tables
  products,
  productVariants,
  productVariantAttributes,
  productTags,
  // Product-level production tables
  productMaterials,
  productEcoClaims,
  productEnvironment,
  productJourneySteps,
  productWeight,
  // Variant-level production tables (for overrides)
  variantMaterials,
  variantEcoClaims,
  variantEnvironment,
  variantJourneySteps,
  variantWeight,
  brands,
} = schema;

// ============================================================================
// Constants
// ============================================================================

/** Batch size for loading staging data */
const LOAD_BATCH_SIZE = 500;
/** Concurrency for image uploads */
const IMAGE_CONCURRENCY = 15;
/** Image upload timeout in ms */
const IMAGE_TIMEOUT_MS = 60_000;

// ============================================================================
// Main Task
// ============================================================================

export const commitToProduction = task({
  id: "commit-to-production",
  maxDuration: 1800, // 30 minutes
  queue: { concurrencyLimit: 3 },
  retry: { maxAttempts: 2 },
  run: async (payload: CommitToProductionPayload): Promise<void> => {
    const { jobId, brandId } = payload;
    const startTime = Date.now();

    logger.info("Starting commit-to-production job", { jobId, brandId });

    const stats: CommitStats = {
      productsCreated: 0,
      productsUpdated: 0,
      variantsCreated: 0,
      variantsUpdated: 0,
      tagsSet: 0,
      attributesSet: 0,
      materialsSet: 0,
      ecoClaimsSet: 0,
      environmentSet: 0,
      journeyStepsSet: 0,
      weightSet: 0,
      imagesProcessed: 0,
      imagesFailed: 0,
    };

    let committedCount = 0;
    let failedCount = 0;

    try {
      // Update job status to COMMITTING
      await db
        .update(importJobs)
        .set({
          status: "COMMITTING",
          commitStartedAt: new Date().toISOString(),
        })
        .where(eq(importJobs.id, jobId));

      // Create Supabase client for storage operations
      const storageClient = createClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY ||
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );

      // PHASE 1: Load all staging data
      logger.info("Phase 1: Loading staging data");
      const loadStart = Date.now();
      const stagingData = await loadAllStagingData(db, jobId);
      logger.info("Staging data loaded", {
        products: stagingData.length,
        variants: stagingData.reduce((sum, p) => sum + p.variants.length, 0),
        duration: `${Date.now() - loadStart}ms`,
      });

      if (stagingData.length === 0) {
        logger.info("No staging data to commit");
        await db
          .update(importJobs)
          .set({
            status: "COMPLETED",
            finishedAt: new Date().toISOString(),
            summary: { committed: 0, failed: 0 },
          })
          .where(eq(importJobs.id, jobId));
        return;
      }

      // PHASE 2: Pre-fetch existing data for enrichment comparison
      logger.info("Phase 2: Pre-fetching existing product data");
      const prefetchStart = Date.now();
      const existingProductIds = stagingData
        .filter((p) => p.existingProductId)
        .map((p) => p.existingProductId as string);

      const existingProducts =
        existingProductIds.length > 0
          ? await db
              .select({ id: products.id, imagePath: products.imagePath })
              .from(products)
              .where(inArray(products.id, existingProductIds))
          : [];

      const existingProductImageMap = new Map(
        existingProducts.map((p) => [p.id, p.imagePath]),
      );
      logger.info("Existing products pre-fetched", {
        count: existingProducts.length,
        duration: `${Date.now() - prefetchStart}ms`,
      });

      // PHASE 3: Process images (with smart change detection)
      logger.info("Phase 3: Processing images");
      const imageStart = Date.now();
      const imageResults = await processImages(
        storageClient,
        brandId,
        stagingData,
        existingProductImageMap,
      );
      stats.imagesProcessed = imageResults.completed;
      stats.imagesFailed = imageResults.failed;
      logger.info("Images processed", {
        processed: imageResults.completed,
        failed: imageResults.failed,
        skipped: imageResults.skipped,
        duration: `${Date.now() - imageStart}ms`,
      });

      // PHASE 4: Commit to production with batch operations
      logger.info("Phase 4: Committing to production");
      const commitStart = Date.now();

      for (const stagingProduct of stagingData) {
        try {
          await commitStagingProductBatched(
            db,
            brandId,
            jobId,
            stagingProduct,
            stats,
          );
          committedCount++;

          // Mark as committed
          await db
            .update(stagingProducts)
            .set({ rowStatus: "COMMITTED" })
            .where(eq(stagingProducts.stagingId, stagingProduct.stagingId));

          // Mark variants as committed
          const variantStagingIds = stagingProduct.variants.map(
            (v) => v.stagingId,
          );
          if (variantStagingIds.length > 0) {
            await db
              .update(stagingProductVariants)
              .set({ rowStatus: "COMMITTED" })
              .where(
                inArray(stagingProductVariants.stagingId, variantStagingIds),
              );
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          logger.error("Failed to commit staging product", {
            stagingId: stagingProduct.stagingId,
            error: errorMessage,
          });

          failedCount++;

          // Mark as failed
          await db
            .update(stagingProducts)
            .set({
              rowStatus: "FAILED",
              errors: [{ field: "commit", message: errorMessage }],
            })
            .where(eq(stagingProducts.stagingId, stagingProduct.stagingId));
        }
      }

      logger.info("Commit phase completed", {
        committed: committedCount,
        failed: failedCount,
        duration: `${Date.now() - commitStart}ms`,
      });

      // PHASE 5: Delete committed staging data
      logger.info("Phase 5: Cleaning up committed staging data");
      await deleteCommittedStagingData(db, jobId);

      // Determine final status
      const hasFailures = failedCount > 0;
      const finalStatus = hasFailures ? "COMPLETED_WITH_FAILURES" : "COMPLETED";

      await db
        .update(importJobs)
        .set({
          status: finalStatus,
          finishedAt: new Date().toISOString(),
          hasExportableFailures: hasFailures,
          summary: {
            committed: committedCount,
            failed: failedCount,
            ...stats,
          },
        })
        .where(eq(importJobs.id, jobId));

      // Revalidate DPP cache for the brand
      await revalidateBrandCache(brandId);

      const duration = Date.now() - startTime;
      logger.info("Commit-to-production completed", {
        jobId,
        committedCount,
        failedCount,
        duration: `${duration}ms`,
        status: finalStatus,
        stats,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error("Commit-to-production failed", {
        jobId,
        error: errorMessage,
      });

      await db
        .update(importJobs)
        .set({
          status: "FAILED",
          finishedAt: new Date().toISOString(),
          summary: { error: errorMessage },
        })
        .where(eq(importJobs.id, jobId));

      throw error;
    }
  },
});

// ============================================================================
// Load All Staging Data
// ============================================================================

/**
 * Load all staging products and their related data for a job.
 * Uses batch loading for efficiency.
 */
async function loadAllStagingData(
  database: Database,
  jobId: string,
): Promise<StagingProductData[]> {
  const allProducts: StagingProductData[] = [];
  let lastRowNumber = 0;
  let hasMore = true;

  while (hasMore) {
    // Load batch of staging products
    const batch = await database
      .select({
        stagingId: stagingProducts.stagingId,
        rowNumber: stagingProducts.rowNumber,
        action: stagingProducts.action,
        existingProductId: stagingProducts.existingProductId,
        id: stagingProducts.id,
        brandId: stagingProducts.brandId,
        name: stagingProducts.name,
        description: stagingProducts.description,
        manufacturerId: stagingProducts.manufacturerId,
        imagePath: stagingProducts.imagePath,
        categoryId: stagingProducts.categoryId,
        seasonId: stagingProducts.seasonId,
        productHandle: stagingProducts.productHandle,
        status: stagingProducts.status,
      })
      .from(stagingProducts)
      .where(
        and(
          eq(stagingProducts.jobId, jobId),
          eq(stagingProducts.rowStatus, "PENDING"),
          sql`${stagingProducts.rowNumber} > ${lastRowNumber}`,
        ),
      )
      .orderBy(stagingProducts.rowNumber)
      .limit(LOAD_BATCH_SIZE);

    if (batch.length === 0) {
      hasMore = false;
      break;
    }

    const stagingIds = batch.map((p) => p.stagingId);

    // Load all related data in parallel (including product-level data)
    const [
      variantsResult,
      tagsResult,
      productMaterialsResult,
      productEcoClaimsResult,
      productEnvironmentResult,
      productJourneyResult,
      productWeightResult,
    ] = await Promise.all([
      loadVariantsWithRelated(database, jobId, stagingIds),
      database
        .select({
          stagingProductId: stagingProductTags.stagingProductId,
          tagId: stagingProductTags.tagId,
        })
        .from(stagingProductTags)
        .where(inArray(stagingProductTags.stagingProductId, stagingIds)),
      // Product-level materials
      database
        .select()
        .from(stagingProductMaterials)
        .where(inArray(stagingProductMaterials.stagingProductId, stagingIds)),
      // Product-level eco claims
      database
        .select()
        .from(stagingProductEcoClaims)
        .where(inArray(stagingProductEcoClaims.stagingProductId, stagingIds)),
      // Product-level environment
      database
        .select()
        .from(stagingProductEnvironment)
        .where(inArray(stagingProductEnvironment.stagingProductId, stagingIds)),
      // Product-level journey steps
      database
        .select()
        .from(stagingProductJourneySteps)
        .where(
          inArray(stagingProductJourneySteps.stagingProductId, stagingIds),
        ),
      // Product-level weight
      database
        .select()
        .from(stagingProductWeight)
        .where(inArray(stagingProductWeight.stagingProductId, stagingIds)),
    ]);

    // Group related data by staging product ID
    const variantsByProduct = new Map<string, StagingVariantData[]>();
    for (const v of variantsResult) {
      const list = variantsByProduct.get(v.stagingProductId) || [];
      list.push(v);
      variantsByProduct.set(v.stagingProductId, list);
    }

    const tagsByProduct = new Map<string, { tagId: string }[]>();
    for (const t of tagsResult) {
      const list = tagsByProduct.get(t.stagingProductId) || [];
      list.push({ tagId: t.tagId });
      tagsByProduct.set(t.stagingProductId, list);
    }

    // Group product-level data by staging product ID
    const materialsByProduct = groupBy(
      productMaterialsResult,
      (m) => m.stagingProductId,
    );
    const ecoClaimsByProduct = groupBy(
      productEcoClaimsResult,
      (c) => c.stagingProductId,
    );
    const envByProduct = new Map(
      productEnvironmentResult.map((e) => [e.stagingProductId, e]),
    );
    const journeyByProduct = groupBy(
      productJourneyResult,
      (j) => j.stagingProductId,
    );
    const weightByProduct = new Map(
      productWeightResult.map((w) => [w.stagingProductId, w]),
    );

    // Assemble product data
    for (const product of batch) {
      allProducts.push({
        ...product,
        variants: variantsByProduct.get(product.stagingId) || [],
        tags: tagsByProduct.get(product.stagingId) || [],
        // Product-level environmental/supply chain data
        materials: (materialsByProduct.get(product.stagingId) || []).map(
          (m) => ({
            brandMaterialId: m.brandMaterialId,
            percentage: m.percentage,
          }),
        ),
        ecoClaims: (ecoClaimsByProduct.get(product.stagingId) || []).map(
          (c) => ({
            ecoClaimId: c.ecoClaimId,
          }),
        ),
        environment: envByProduct.get(product.stagingId)
          ? {
              carbonKgCo2E: envByProduct.get(product.stagingId)!.carbonKgCo2E,
              waterLiters: envByProduct.get(product.stagingId)!.waterLiters,
            }
          : null,
        journeySteps: (journeyByProduct.get(product.stagingId) || []).map(
          (j) => ({
            sortIndex: j.sortIndex,
            stepType: j.stepType,
            facilityId: j.facilityId,
          }),
        ),
        weight: weightByProduct.get(product.stagingId)
          ? {
              weight: weightByProduct.get(product.stagingId)!.weight,
              weightUnit: weightByProduct.get(product.stagingId)!.weightUnit,
            }
          : null,
      });
      lastRowNumber = product.rowNumber;
    }
  }

  return allProducts;
}

/**
 * Load all variants with their related data.
 */
async function loadVariantsWithRelated(
  database: Database,
  jobId: string,
  stagingProductIds: string[],
): Promise<(StagingVariantData & { stagingProductId: string })[]> {
  // Load variants
  const variants = await database
    .select({
      stagingId: stagingProductVariants.stagingId,
      stagingProductId: stagingProductVariants.stagingProductId,
      rowNumber: stagingProductVariants.rowNumber,
      action: stagingProductVariants.action,
      existingVariantId: stagingProductVariants.existingVariantId,
      id: stagingProductVariants.id,
      productId: stagingProductVariants.productId,
      upid: stagingProductVariants.upid,
      barcode: stagingProductVariants.barcode,
      sku: stagingProductVariants.sku,
      nameOverride: stagingProductVariants.nameOverride,
      descriptionOverride: stagingProductVariants.descriptionOverride,
      imagePathOverride: stagingProductVariants.imagePathOverride,
    })
    .from(stagingProductVariants)
    .where(inArray(stagingProductVariants.stagingProductId, stagingProductIds));

  if (variants.length === 0) return [];

  const variantStagingIds = variants.map((v) => v.stagingId);

  // Load all variant-related data in parallel
  const [
    attributesResult,
    materialsResult,
    ecoClaimsResult,
    environmentResult,
    journeyResult,
    weightResult,
  ] = await Promise.all([
    database
      .select()
      .from(stagingVariantAttributes)
      .where(
        inArray(stagingVariantAttributes.stagingVariantId, variantStagingIds),
      ),
    database
      .select()
      .from(stagingVariantMaterials)
      .where(
        inArray(stagingVariantMaterials.stagingVariantId, variantStagingIds),
      ),
    database
      .select()
      .from(stagingVariantEcoClaims)
      .where(
        inArray(stagingVariantEcoClaims.stagingVariantId, variantStagingIds),
      ),
    database
      .select()
      .from(stagingVariantEnvironment)
      .where(
        inArray(stagingVariantEnvironment.stagingVariantId, variantStagingIds),
      ),
    database
      .select()
      .from(stagingVariantJourneySteps)
      .where(
        inArray(stagingVariantJourneySteps.stagingVariantId, variantStagingIds),
      ),
    database
      .select()
      .from(stagingVariantWeight)
      .where(inArray(stagingVariantWeight.stagingVariantId, variantStagingIds)),
  ]);

  // Group by variant staging ID
  const attrsByVariant = groupBy(attributesResult, (a) => a.stagingVariantId);
  const matsByVariant = groupBy(materialsResult, (m) => m.stagingVariantId);
  const claimsByVariant = groupBy(ecoClaimsResult, (c) => c.stagingVariantId);
  const envByVariant = new Map(
    environmentResult.map((e) => [e.stagingVariantId, e]),
  );
  const journeyByVariant = groupBy(journeyResult, (j) => j.stagingVariantId);
  const weightByVariant = new Map(
    weightResult.map((w) => [w.stagingVariantId, w]),
  );

  // Assemble variant data
  return variants.map((v) => ({
    ...v,
    attributes: (attrsByVariant.get(v.stagingId) || []).map((a) => ({
      attributeId: a.attributeId,
      attributeValueId: a.attributeValueId,
      sortOrder: a.sortOrder,
    })),
    materials: (matsByVariant.get(v.stagingId) || []).map((m) => ({
      brandMaterialId: m.brandMaterialId,
      percentage: m.percentage,
    })),
    ecoClaims: (claimsByVariant.get(v.stagingId) || []).map((c) => ({
      ecoClaimId: c.ecoClaimId,
    })),
    environment: envByVariant.get(v.stagingId)
      ? {
          carbonKgCo2e: envByVariant.get(v.stagingId)!.carbonKgCo2e,
          waterLiters: envByVariant.get(v.stagingId)!.waterLiters,
        }
      : null,
    journeySteps: (journeyByVariant.get(v.stagingId) || []).map((j) => ({
      sortIndex: j.sortIndex,
      stepType: j.stepType,
      facilityId: j.facilityId,
    })),
    weight: weightByVariant.get(v.stagingId)
      ? {
          weight: weightByVariant.get(v.stagingId)!.weight,
          weightUnit: weightByVariant.get(v.stagingId)!.weightUnit,
        }
      : null,
  }));
}

// ============================================================================
// Image Processing
// ============================================================================

/**
 * Extract URL hash for comparison (matches the hash used in downloadAndUploadImage).
 */
function getUrlHash(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

/**
 * Check if existing image path was generated from the same source URL.
 * The filename in storage is based on the URL hash, so we can compare.
 */
function isSameImageSource(
  existingPath: string | null,
  newUrl: string,
): boolean {
  if (!existingPath) return false;

  const urlHash = getUrlHash(newUrl);
  // Storage paths are like "brandId/abc123def456.jpg" - extract the filename
  const filename = existingPath.split("/").pop() || "";
  // Filename is like "abc123def456.jpg" - extract the hash part
  const existingHash = filename.split(".")[0];

  return existingHash === urlHash;
}

/**
 * Process all images with rate limiting.
 * Returns counts of completed, failed, and skipped images.
 */
async function processImages(
  storageClient: SupabaseClient,
  brandId: string,
  stagingData: StagingProductData[],
  existingProductImageMap: Map<string, string | null>,
): Promise<{ completed: number; failed: number; skipped: number }> {
  const tasks: ImageUploadTask[] = [];
  let skipped = 0;

  // Collect all image upload tasks
  for (const product of stagingData) {
    // Product-level image
    if (product.imagePath && isExternalImageUrl(product.imagePath)) {
      const existingImagePath = existingProductImageMap.get(
        product.existingProductId || "",
      );

      // Check if this is the same image source (skip if unchanged)
      if (
        product.existingProductId &&
        existingImagePath &&
        isSameImageSource(existingImagePath, product.imagePath)
      ) {
        // Same image - use existing path instead of re-downloading
        product.imagePath = existingImagePath ?? null;
        skipped++;
      } else {
        // New or changed image - queue for download
        tasks.push({
          type: "product",
          entityId: product.id,
          imageUrl: product.imagePath,
        });
      }
    }

    // Variant-level image overrides
    for (const variant of product.variants) {
      if (
        variant.imagePathOverride &&
        isExternalImageUrl(variant.imagePathOverride)
      ) {
        // For variants, always process (we don't track variant-level image sources)
        // Could be optimized in the future with a similar approach
        tasks.push({
          type: "variant",
          entityId: variant.id,
          imageUrl: variant.imagePathOverride,
        });
      }
    }
  }

  if (tasks.length === 0) {
    return { completed: 0, failed: 0, skipped };
  }

  logger.info(
    `Processing ${tasks.length} images (${skipped} skipped as unchanged)`,
  );

  // Process with rate limiting
  let completed = 0;
  let failed = 0;
  let currentIndex = 0;

  // Create a map to store results
  const imagePathResults = new Map<string, string | null>();

  await new Promise<void>((resolve) => {
    const processNext = async () => {
      if (currentIndex >= tasks.length) {
        // Check if all tasks are done
        if (completed + failed === tasks.length) {
          resolve();
        }
        return;
      }

      const task = tasks[currentIndex++]!;

      try {
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(
            () => reject(new Error("Image upload timeout")),
            IMAGE_TIMEOUT_MS,
          ),
        );

        const pathPrefix =
          task.type === "product" ? brandId : `${brandId}/variants`;

        const uploadPromise = downloadAndUploadImage(storageClient, {
          url: task.imageUrl,
          bucket: "products",
          pathPrefix,
        });

        const path = await Promise.race([uploadPromise, timeoutPromise]);

        if (path) {
          imagePathResults.set(`${task.type}:${task.entityId}`, path as string);
          completed++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      } finally {
        // Start next task or check if done
        if (currentIndex < tasks.length) {
          processNext();
        }
        if (completed + failed === tasks.length) {
          resolve();
        }
      }
    };

    // Start initial batch
    const initialBatch = Math.min(IMAGE_CONCURRENCY, tasks.length);
    for (let i = 0; i < initialBatch; i++) {
      processNext();
    }
  });

  // Update staging data with new image paths
  for (const product of stagingData) {
    const productPath = imagePathResults.get(`product:${product.id}`);
    if (productPath) {
      product.imagePath = productPath;
    }

    for (const variant of product.variants) {
      const variantPath = imagePathResults.get(`variant:${variant.id}`);
      if (variantPath) {
        variant.imagePathOverride = variantPath;
      }
    }
  }

  return { completed, failed, skipped };
}

// ============================================================================
// Commit Staging Product (Batched)
// ============================================================================

/**
 * Commit a single staging product and all its related data.
 * Uses transactions for atomicity.
 */
async function commitStagingProductBatched(
  database: Database,
  brandId: string,
  jobId: string,
  stagingProduct: StagingProductData,
  stats: CommitStats,
): Promise<void> {
  const { action, existingProductId, id: productId } = stagingProduct;

  // Pre-transaction: Generate UPIDs for new variants that don't have one
  // This must be done before the transaction to avoid database queries inside tx
  const variantsNeedingUpids = stagingProduct.variants.filter(
    (v) => v.action === "CREATE" && !v.upid,
  );

  let generatedUpids: string[] = [];
  if (variantsNeedingUpids.length > 0) {
    generatedUpids = await generateUniqueUpids({
      count: variantsNeedingUpids.length,
      isTaken: async (candidate) => {
        const [existing] = await database
          .select({ id: productVariants.id })
          .from(productVariants)
          .where(eq(productVariants.upid, candidate))
          .limit(1);
        return Boolean(existing);
      },
      fetchTakenSet: async (candidates) => {
        const rows = await database
          .select({ upid: productVariants.upid })
          .from(productVariants)
          .where(inArray(productVariants.upid, candidates as string[]));
        return new Set(rows.map((r) => r.upid).filter(Boolean) as string[]);
      },
    });
  }

  // Create a map of stagingId -> generated UPID
  const upidMap = new Map<string, string>();
  variantsNeedingUpids.forEach((v, index) => {
    upidMap.set(v.stagingId, generatedUpids[index]!);
  });

  await database.transaction(async (tx) => {
    // 1. Create or update product
    if (action === "CREATE") {
      await tx.insert(products).values({
        id: productId,
        brandId,
        name: stagingProduct.name,
        productHandle: stagingProduct.productHandle ?? productId,
        description: stagingProduct.description ?? undefined,
        categoryId: stagingProduct.categoryId ?? undefined,
        seasonId: stagingProduct.seasonId ?? undefined,
        manufacturerId: stagingProduct.manufacturerId ?? undefined,
        imagePath: stagingProduct.imagePath ?? undefined,
        status: stagingProduct.status ?? "unpublished",
      });
      stats.productsCreated++;
    } else if (action === "UPDATE" && existingProductId) {
      // One-way merge: Only apply non-null/non-empty values from staging
      const updateData: Record<string, unknown> = {};

      if (stagingProduct.name?.trim()) updateData.name = stagingProduct.name;
      if (stagingProduct.productHandle?.trim())
        updateData.productHandle = stagingProduct.productHandle;
      if (stagingProduct.description?.trim())
        updateData.description = stagingProduct.description;
      if (stagingProduct.categoryId)
        updateData.categoryId = stagingProduct.categoryId;
      if (stagingProduct.seasonId)
        updateData.seasonId = stagingProduct.seasonId;
      if (stagingProduct.manufacturerId)
        updateData.manufacturerId = stagingProduct.manufacturerId;
      if (stagingProduct.imagePath?.trim())
        updateData.imagePath = stagingProduct.imagePath;
      if (stagingProduct.status?.trim())
        updateData.status = stagingProduct.status;

      if (Object.keys(updateData).length > 0) {
        await tx
          .update(products)
          .set(updateData)
          .where(eq(products.id, existingProductId));
        stats.productsUpdated++;
      }
    }

    // 2. Process variants
    for (const variant of stagingProduct.variants) {
      const variantId = variant.id;

      if (variant.action === "CREATE") {
        // Use existing UPID if provided, otherwise use the generated one
        const upid = variant.upid || upidMap.get(variant.stagingId);

        await tx.insert(productVariants).values({
          id: variantId,
          productId,
          upid,
          barcode: variant.barcode,
          sku: variant.sku,
          name: variant.nameOverride ?? undefined,
          description: variant.descriptionOverride ?? undefined,
          imagePath: variant.imagePathOverride ?? undefined,
        });
        stats.variantsCreated++;
      } else if (variant.action === "UPDATE" && variant.existingVariantId) {
        const variantUpdateData: Record<string, unknown> = {};

        if (variant.upid?.trim()) variantUpdateData.upid = variant.upid;
        if (variant.barcode?.trim())
          variantUpdateData.barcode = variant.barcode;
        if (variant.sku?.trim()) variantUpdateData.sku = variant.sku;
        if (variant.nameOverride?.trim())
          variantUpdateData.name = variant.nameOverride;
        if (variant.descriptionOverride?.trim())
          variantUpdateData.description = variant.descriptionOverride;
        if (variant.imagePathOverride?.trim())
          variantUpdateData.imagePath = variant.imagePathOverride;

        if (Object.keys(variantUpdateData).length > 0) {
          await tx
            .update(productVariants)
            .set(variantUpdateData)
            .where(eq(productVariants.id, variant.existingVariantId));
          stats.variantsUpdated++;
        }
      }

      // 3. Variant attributes (replace)
      if (variant.attributes.length > 0) {
        await tx
          .delete(productVariantAttributes)
          .where(eq(productVariantAttributes.variantId, variantId));
        await tx.insert(productVariantAttributes).values(
          variant.attributes.map((a) => ({
            variantId,
            attributeId: a.attributeId,
            attributeValueId: a.attributeValueId,
            sortOrder: a.sortOrder,
          })),
        );
        stats.attributesSet += variant.attributes.length;
      }

      // 4. Variant materials (replace)
      if (variant.materials.length > 0) {
        await tx
          .delete(variantMaterials)
          .where(eq(variantMaterials.variantId, variantId));
        await tx.insert(variantMaterials).values(
          variant.materials.map((m) => ({
            variantId,
            brandMaterialId: m.brandMaterialId,
            percentage: m.percentage,
          })),
        );
        stats.materialsSet += variant.materials.length;
      }

      // 5. Variant eco claims (replace)
      if (variant.ecoClaims.length > 0) {
        await tx
          .delete(variantEcoClaims)
          .where(eq(variantEcoClaims.variantId, variantId));
        await tx.insert(variantEcoClaims).values(
          variant.ecoClaims.map((c) => ({
            variantId,
            ecoClaimId: c.ecoClaimId,
          })),
        );
        stats.ecoClaimsSet += variant.ecoClaims.length;
      }

      // 6. Variant environment (upsert)
      if (variant.environment) {
        await tx
          .insert(variantEnvironment)
          .values({
            variantId,
            carbonKgCo2e: variant.environment.carbonKgCo2e,
            waterLiters: variant.environment.waterLiters,
          })
          .onConflictDoUpdate({
            target: variantEnvironment.variantId,
            set: {
              carbonKgCo2e: variant.environment.carbonKgCo2e,
              waterLiters: variant.environment.waterLiters,
            },
          });
        stats.environmentSet++;
      }

      // 7. Variant journey steps (replace)
      if (variant.journeySteps.length > 0) {
        await tx
          .delete(variantJourneySteps)
          .where(eq(variantJourneySteps.variantId, variantId));
        await tx.insert(variantJourneySteps).values(
          variant.journeySteps.map((j) => ({
            variantId,
            sortIndex: j.sortIndex,
            stepType: j.stepType,
            facilityId: j.facilityId,
          })),
        );
        stats.journeyStepsSet += variant.journeySteps.length;
      }

      // 8. Variant weight (upsert)
      if (variant.weight) {
        await tx
          .insert(variantWeight)
          .values({
            variantId,
            weight: variant.weight.weight,
            weightUnit: variant.weight.weightUnit,
          })
          .onConflictDoUpdate({
            target: variantWeight.variantId,
            set: {
              weight: variant.weight.weight,
              weightUnit: variant.weight.weightUnit,
            },
          });
        stats.weightSet++;
      }
    }

    // 3. Product tags (replace)
    if (stagingProduct.tags.length > 0) {
      await tx.delete(productTags).where(eq(productTags.productId, productId));
      await tx.insert(productTags).values(
        stagingProduct.tags.map((t) => ({
          productId,
          tagId: t.tagId,
        })),
      );
      stats.tagsSet += stagingProduct.tags.length;
    }

    // ============================================================================
    // PRODUCT-LEVEL DATA (from parent row)
    // These are the environmental/material/journey data at the product level
    // ============================================================================

    // 4. Product materials (replace)
    if (stagingProduct.materials.length > 0) {
      await tx
        .delete(productMaterials)
        .where(eq(productMaterials.productId, productId));
      await tx.insert(productMaterials).values(
        stagingProduct.materials.map((m) => ({
          productId,
          brandMaterialId: m.brandMaterialId,
          percentage: m.percentage,
        })),
      );
      stats.materialsSet += stagingProduct.materials.length;
    }

    // 5. Product eco claims (replace)
    if (stagingProduct.ecoClaims.length > 0) {
      await tx
        .delete(productEcoClaims)
        .where(eq(productEcoClaims.productId, productId));
      await tx.insert(productEcoClaims).values(
        stagingProduct.ecoClaims.map((c) => ({
          productId,
          ecoClaimId: c.ecoClaimId,
        })),
      );
      stats.ecoClaimsSet += stagingProduct.ecoClaims.length;
    }

    // 6. Product environment (metric-keyed structure - separate rows for carbon and water)
    if (stagingProduct.environment) {
      // Insert/update carbon footprint metric
      if (stagingProduct.environment.carbonKgCo2E) {
        await tx
          .insert(productEnvironment)
          .values({
            productId,
            metric: "carbon_kg_co2e",
            value: stagingProduct.environment.carbonKgCo2E,
            unit: "kg_co2e",
          })
          .onConflictDoUpdate({
            target: [productEnvironment.productId, productEnvironment.metric],
            set: {
              value: stagingProduct.environment.carbonKgCo2E,
              unit: "kg_co2e",
            },
          });
        stats.environmentSet++;
      }

      // Insert/update water usage metric
      if (stagingProduct.environment.waterLiters) {
        await tx
          .insert(productEnvironment)
          .values({
            productId,
            metric: "water_liters",
            value: stagingProduct.environment.waterLiters,
            unit: "liters",
          })
          .onConflictDoUpdate({
            target: [productEnvironment.productId, productEnvironment.metric],
            set: {
              value: stagingProduct.environment.waterLiters,
              unit: "liters",
            },
          });
        stats.environmentSet++;
      }
    }

    // 7. Product journey steps (replace)
    if (stagingProduct.journeySteps.length > 0) {
      await tx
        .delete(productJourneySteps)
        .where(eq(productJourneySteps.productId, productId));
      await tx.insert(productJourneySteps).values(
        stagingProduct.journeySteps.map((j) => ({
          productId,
          sortIndex: j.sortIndex,
          stepType: j.stepType,
          facilityId: j.facilityId,
        })),
      );
      stats.journeyStepsSet += stagingProduct.journeySteps.length;
    }

    // 8. Product weight (upsert)
    if (stagingProduct.weight) {
      await tx
        .insert(productWeight)
        .values({
          productId,
          weight: stagingProduct.weight.weight,
          weightUnit: stagingProduct.weight.weightUnit,
        })
        .onConflictDoUpdate({
          target: productWeight.productId,
          set: {
            weight: stagingProduct.weight.weight,
            weightUnit: stagingProduct.weight.weightUnit,
          },
        });
      stats.weightSet++;
    }
  });
}

// ============================================================================
// Delete Committed Staging Data
// ============================================================================

async function deleteCommittedStagingData(
  database: Database,
  jobId: string,
): Promise<void> {
  // Get all COMMITTED staging product IDs
  const committedProducts = await database
    .select({ stagingId: stagingProducts.stagingId })
    .from(stagingProducts)
    .where(
      and(
        eq(stagingProducts.jobId, jobId),
        eq(stagingProducts.rowStatus, "COMMITTED"),
      ),
    );

  if (committedProducts.length === 0) {
    return;
  }

  const stagingIds = committedProducts.map((p) => p.stagingId);

  // Delete in batches to avoid memory issues
  const CHUNK_SIZE = 500;
  for (let i = 0; i < stagingIds.length; i += CHUNK_SIZE) {
    const chunk = stagingIds.slice(i, i + CHUNK_SIZE);

    // Delete cascades from staging_products to related tables
    await database.delete(stagingProducts).where(
      sql`${stagingProducts.stagingId} = ANY(ARRAY[${sql.join(
        chunk.map((id) => sql`${id}`),
        sql`, `,
      )}]::uuid[])`,
    );
  }

  logger.info("Deleted committed staging data", {
    jobId,
    count: stagingIds.length,
  });
}

// ============================================================================
// Revalidate Brand Cache
// ============================================================================

async function revalidateBrandCache(brandId: string): Promise<void> {
  try {
    const [brand] = await db
      .select({ slug: brands.slug })
      .from(brands)
      .where(eq(brands.id, brandId))
      .limit(1);

    if (brand?.slug) {
      await revalidateBrand(brand.slug);
      logger.info("DPP cache revalidated", { brandSlug: brand.slug });
    }
  } catch (error) {
    // Don't fail the job if revalidation fails
    logger.warn("DPP cache revalidation failed (non-fatal)", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function groupBy<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K,
): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const list = map.get(key) || [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}
