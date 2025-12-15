import "../configure-trigger";
import { logger, task } from "@trigger.dev/sdk/v3";
import { db } from "@v1/db/client";
import type { Database } from "@v1/db/client";
import { eq } from "@v1/db/index";
import {
  type StagingProductPreview,
  batchUpdateImportRowStatus,
  bulkCreateProductsFromStaging,
  createProduct,
  deleteStagingDataForJob,
  getImportJobStatus,
  getStagingProductsForCommit,
  setProductEcoClaims,
  setProductJourneySteps,
  updateImportJobProgress,
  updateImportJobStatus,
  updateProduct,
  upsertProductEnvironment,
  upsertProductMaterials,
} from "@v1/db/queries";
import { brands, productVariants } from "@v1/db/schema";
import { revalidateBrand } from "../../lib/dpp-revalidation";
import { ProgressEmitter } from "./progress-emitter";

/**
 * Task payload for Phase 2 production commit
 */
interface CommitToProductionPayload {
  jobId: string;
  brandId: string;
}

/**
 * Result of committing a single row
 */
interface CommitRowResult {
  rowNumber: number;
  importRowId: string;
  action: "CREATE" | "UPDATE";
  success: boolean;
  error?: string;
  productId?: string;
  variantId?: string;
}

interface BatchTimingSnapshot {
  batchNumber: number;
  startRowNumber: number;
  endRowNumber: number;
  rowCount: number;
  fetchMs: number;
  processMs: number;
  progressMs: number;
  totalMs: number;
}

const BATCH_SIZE = 1000; // Optimized for maximum throughput
const ROW_CONCURRENCY = resolveRowConcurrency();
const STAGING_DELETE_CHUNK_SIZE = resolveDeleteChunkSize();
const TIMEOUT_MS = 1800000; // 30 minutes
const PROGRESS_UPDATE_FREQUENCY = 5; // Update progress every N batches

/**
 * Phase 2: Commit validated staging data to production tables
 *
 * This background job:
 * 1. Loads validated data from staging tables in batches
 * 2. For each staging row, performs CREATE or UPDATE based on action field
 * 3. Uses database transactions for each batch to ensure atomicity
 * 4. Upserts related tables (materials, care codes, eco claims, etc.)
 * 5. Tracks row-level success/failure with partial success support
 * 6. Cleans up staging data after successful commit
 * 7. Sends WebSocket progress updates (TODO: implement WebSocket)
 *
 * Processes data in batches of 100 rows with transaction rollback on batch failures.
 */
export const commitToProduction = task({
  id: "commit-to-production",
  maxDuration: 1800, // 30 minutes max - handles large imports with 10k+ rows
  queue: {
    concurrencyLimit: 3,
  },
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 60000,
    factor: 2,
    randomize: true,
  },
  run: async (payload: CommitToProductionPayload): Promise<void> => {
    const { jobId, brandId } = payload;
    const jobStartTime = Date.now();
    const batchTimings: BatchTimingSnapshot[] = [];
    const failedRowIds: string[] = [];
    const progressEmitter = new ProgressEmitter();
    let totalRows = 0;
    let processedCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let failedCount = 0;

    logger.info("Starting commit-to-production job", {
      jobId,
      brandId,
    });

    try {
      const job = await getImportJobStatus(db, jobId);
      if (!job) {
        throw new Error(`Import job ${jobId} not found`);
      }

      if (job.brandId !== brandId) {
        throw new Error(
          `Cannot commit job ${jobId}: payload brand ${brandId} does not match job brand ${job.brandId}.`,
        );
      }

      if (job.status === "COMMITTING") {
        logger.warn("Commit job already in progress; continuing", {
          jobId,
          brandId,
        });
      } else if (job.status !== "VALIDATED") {
        throw new Error(
          `Cannot commit job with status ${job.status}. Job must be in VALIDATED status.`,
        );
      }

      if (job.status !== "COMMITTING") {
        await updateImportJobStatus(db, {
          jobId,
          status: "COMMITTING",
          commitStartedAt: new Date().toISOString(),
        });
      }

      totalRows =
        ((job.summary as Record<string, unknown>)?.total as number) || 0;
      processedCount = 0;
      createdCount = 0;
      updatedCount = 0;
      failedCount = 0;

      logger.info("Starting production commit", {
        jobId,
        totalRows,
        rowConcurrency: ROW_CONCURRENCY,
        deleteChunkSize: STAGING_DELETE_CHUNK_SIZE,
      });

      // Process staging data in batches
      let cursorRowNumber: number | null = null;
      let hasMore = true;
      let batchNumber = 1;

      while (hasMore) {
        // Load batch from staging tables
        const batchStartMs = Date.now();
        const fetchStart = Date.now();
        const stagingBatch = await getStagingProductsForCommit(
          db,
          jobId,
          BATCH_SIZE,
          cursorRowNumber ?? undefined,
        );
        const fetchDurationMs = Date.now() - fetchStart;

        if (stagingBatch.length === 0) {
          hasMore = false;
          break;
        }

        const startRowNumber = stagingBatch[0]?.rowNumber ?? 0;
        const endRowNumber =
          stagingBatch[stagingBatch.length - 1]?.rowNumber ?? startRowNumber;

        logger.info(
          `Processing batch ${batchNumber} (rows ${startRowNumber}-${endRowNumber})`,
          {
            batchSize: stagingBatch.length,
            processedCount,
            totalRows,
          },
        );

        // Process batch within a transaction
        const processStart = Date.now();
        const batchResults = await processBatch(
          db,
          brandId,
          stagingBatch,
          jobId,
        );
        const processDurationMs = Date.now() - processStart;

        // Update counters based on batch results
        for (const result of batchResults) {
          processedCount++;

          if (result.success) {
            if (result.action === "CREATE") {
              createdCount++;
            } else {
              updatedCount++;
            }
          } else {
            failedCount++;
            if (result.importRowId) {
              failedRowIds.push(result.importRowId);
            }
          }
        }

        // Update job progress (only every N batches to reduce overhead)
        const progressStart = Date.now();
        let progressDurationMs = 0;
        const shouldUpdateProgress =
          batchNumber % PROGRESS_UPDATE_FREQUENCY === 0 || !hasMore;

        if (shouldUpdateProgress) {
          const percentage =
            totalRows > 0
              ? Math.round((processedCount / totalRows) * 100)
              : 100;
          await updateImportJobProgress(db, {
            jobId,
            summary: {
              total: totalRows,
              processed: processedCount,
              created: createdCount,
              updated: updatedCount,
              failed: failedCount,
              percentage,
            },
          });
          progressEmitter.emit({
            jobId,
            status: "COMMITTING",
            phase: "commit",
            processed: processedCount,
            total: totalRows,
            created: createdCount,
            updated: updatedCount,
            failed: failedCount,
            percentage,
          });
          progressDurationMs = Date.now() - progressStart;
        }
        const totalBatchDurationMs = Date.now() - batchStartMs;
        batchTimings.push({
          batchNumber,
          startRowNumber,
          endRowNumber,
          rowCount: stagingBatch.length,
          fetchMs: fetchDurationMs,
          processMs: processDurationMs,
          progressMs: progressDurationMs,
          totalMs: totalBatchDurationMs,
        });

        // Send WebSocket progress update (temporarily disabled)
        // websocketManager.emit(jobId, {
        //   jobId,
        //   status: "COMMITTING",
        //   phase: "commit",
        //   processed: processedCount,
        //   total: totalRows,
        //   created: createdCount,
        //   updated: updatedCount,
        //   failed: failedCount,
        //   percentage: Math.round((processedCount / totalRows) * 100),
        // });

        logger.info("Batch committed", {
          batchNumber,
          processedCount,
          createdCount,
          updatedCount,
          failedCount,
          fetchDurationMs,
          processDurationMs,
          progressDurationMs,
          totalBatchDurationMs,
          rowConcurrency: ROW_CONCURRENCY,
        });

        cursorRowNumber = endRowNumber;
        batchNumber += 1;
      }

      // Clean up staging data
      logger.info("Cleaning up staging data", { jobId });
      const cleanupStart = Date.now();
      const deletedCount = await deleteStagingDataForJob(
        db,
        jobId,
        STAGING_DELETE_CHUNK_SIZE,
      );
      const cleanupDurationMs = Date.now() - cleanupStart;
      logger.info("Staging data cleaned up", {
        jobId,
        deletedCount,
        cleanupDurationMs,
        deleteChunkSize: STAGING_DELETE_CHUNK_SIZE,
      });

      // Update job status to COMPLETED
      const totalDurationMs = Date.now() - jobStartTime;
      const timingSummary = summarizeTimings(
        totalDurationMs,
        batchTimings,
        cleanupDurationMs,
      );
      await updateImportJobStatus(db, {
        jobId,
        status: "COMPLETED",
        finishedAt: new Date().toISOString(),
        summary: {
          total: totalRows,
          created: createdCount,
          updated: updatedCount,
          failed: failedCount,
          failedRowIds: failedRowIds.length > 0 ? failedRowIds : undefined,
          timings: timingSummary,
        },
      });
      progressEmitter.emit({
        jobId,
        status: "COMPLETED",
        phase: "commit",
        processed: totalRows,
        total: totalRows,
        created: createdCount,
        updated: updatedCount,
        failed: failedCount,
        percentage: 100,
        message: "Import completed successfully",
      });
      await progressEmitter.flush();

      // Send WebSocket completion notification (temporarily disabled)
      // websocketManager.emit(jobId, {
      //   jobId,
      //   status: "COMPLETED",
      //   phase: "commit",
      //   processed: totalRows,
      //   total: totalRows,
      //   created: createdCount,
      //   updated: updatedCount,
      //   failed: failedCount,
      //   percentage: 100,
      //   message: "Import completed successfully",
      // });

      // Revalidate DPP cache for the brand (fire-and-forget)
      // This ensures all DPP pages reflect the imported data
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
      } catch (revalidateError) {
        // Don't fail the job if revalidation fails
        logger.warn("DPP cache revalidation failed (non-fatal)", {
          error:
            revalidateError instanceof Error
              ? revalidateError.message
              : String(revalidateError),
        });
      }

      logger.info("Production commit completed successfully", {
        jobId,
        total: totalRows,
        created: createdCount,
        updated: updatedCount,
        failed: failedCount,
        totalDurationMs,
      });
    } catch (error) {
      logger.error("Production commit job failed", {
        jobId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      const totalDurationMs = Date.now() - jobStartTime;
      const timingSummary = summarizeTimings(totalDurationMs, batchTimings);

      // Clean up staging data even on failure to prevent orphaned records
      try {
        logger.info("Cleaning up staging data after failure", { jobId });
        const deletedCount = await deleteStagingDataForJob(
          db,
          jobId,
          STAGING_DELETE_CHUNK_SIZE,
        );
        logger.info("Staging data cleaned up after failure", {
          jobId,
          deletedCount,
          deleteChunkSize: STAGING_DELETE_CHUNK_SIZE,
        });
      } catch (cleanupError) {
        logger.error("Failed to clean up staging data after commit failure", {
          jobId,
          cleanupError:
            cleanupError instanceof Error
              ? cleanupError.message
              : String(cleanupError),
        });
        // Continue to update job status even if cleanup fails
      }

      // Update job status to FAILED
      await updateImportJobStatus(db, {
        jobId,
        status: "FAILED",
        finishedAt: new Date().toISOString(),
        summary: {
          error: error instanceof Error ? error.message : "Unknown error",
          failedRowIds: failedRowIds.length > 0 ? failedRowIds : undefined,
          timings: timingSummary,
        },
      });
      progressEmitter.emit({
        jobId,
        status: "FAILED",
        phase: "commit",
        processed: 0,
        total: 0,
        failed: failedCount,
        percentage: 0,
        message:
          error instanceof Error ? error.message : "Production commit failed",
      });
      await progressEmitter.flush();

      // Send WebSocket failure notification (temporarily disabled)
      // websocketManager.emit(jobId, {
      //   jobId,
      //   status: "FAILED",
      //   phase: "commit",
      //   processed: 0,
      //   total: 0,
      //   percentage: 0,
      //   message:
      //     error instanceof Error ? error.message : "Production commit failed",
      // });

      throw error;
    }
  },
});

/**
 * Process a batch of staging products with transaction rollback on failure
 *
 * @param db - Database instance
 * @param brandId - Brand ID for authorization
 * @param stagingBatch - Array of staging products to commit
 * @param jobId - Import job ID
 * @returns Array of commit results for each row
 */
async function processBatch(
  db: Database,
  brandId: string,
  stagingBatch: StagingProductPreview[],
  jobId: string,
): Promise<CommitRowResult[]> {
  const results: CommitRowResult[] = [];
  const queue = [...stagingBatch];
  const workerCount = Math.min(ROW_CONCURRENCY, queue.length || 1);
  const createRows = stagingBatch.filter(
    (row) => row.action === "CREATE" && !row.existingProductId,
  );
  const precreatedProducts =
    createRows.length > 0
      ? await bulkCreateProductsFromStaging(db, brandId, createRows)
      : new Map<string, string>();

  if (precreatedProducts.size > 0) {
    logger.info("Pre-created products for batch", {
      count: precreatedProducts.size,
      batchSize: stagingBatch.length,
    });
  }

  const worker = async () => {
    while (true) {
      const stagingProduct = queue.shift();
      if (!stagingProduct) {
        break;
      }

      try {
        const precreatedProductId =
          stagingProduct.action === "CREATE"
            ? precreatedProducts.get(stagingProduct.stagingId)
            : undefined;
        const result = await commitStagingRow(
          db,
          brandId,
          stagingProduct,
          jobId,
          precreatedProductId,
        );
        results.push(result);
      } catch (error) {
        logger.error("Failed to commit staging row", {
          rowNumber: stagingProduct.rowNumber,
          error: error instanceof Error ? error.message : String(error),
        });

        results.push({
          rowNumber: stagingProduct.rowNumber,
          importRowId: "", // Will be looked up if needed
          action: stagingProduct.action as "CREATE" | "UPDATE",
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

/**
 * Commit a single staging row to production tables
 *
 * @param db - Database instance
 * @param brandId - Brand ID for authorization
 * @param stagingProduct - Staging product to commit
 * @param jobId - Import job ID
 * @param precreatedProductId - Optional pre-created product ID for CREATE rows
 * @returns Commit result
 */
async function commitStagingRow(
  db: Database,
  brandId: string,
  stagingProduct: StagingProductPreview,
  jobId: string,
  precreatedProductId?: string,
): Promise<CommitRowResult> {
  const { action, rowNumber, variant } = stagingProduct;
  const rowStart = Date.now();
  let relationDurationMs = 0;
  let coreDurationMs = 0;

  if (!variant) {
    throw new Error("Staging product missing variant data");
  }

  let productId: string | undefined;
  let variantId: string | undefined;
  let importRowId = "";

  try {
    // Execute within a transaction for atomicity
    await db.transaction(async (tx) => {
      // Step 1: Create or update the product
      const coreStart = Date.now();
      if (action === "CREATE") {
        if (precreatedProductId) {
          productId = precreatedProductId;
        } else {
          const created = await createProduct(
            tx as unknown as Database,
            brandId,
            {
              name: stagingProduct.name,
              productHandle: stagingProduct.productHandle ?? undefined,
              description: stagingProduct.description || undefined,
              categoryId: stagingProduct.categoryId || undefined,
              seasonId: stagingProduct.seasonId ?? undefined,
              manufacturerId: stagingProduct.manufacturerId ?? undefined,
              primaryImagePath: stagingProduct.primaryImagePath ?? undefined,
              status: stagingProduct.status ?? undefined,
            },
          );

          if (!created?.id) {
            throw new Error("Failed to create product");
          }

          productId = created.id;
        }
      } else {
        // UPDATE action
        if (!stagingProduct.existingProductId) {
          throw new Error("UPDATE action missing existingProductId");
        }

        const updated = await updateProduct(
          tx as unknown as Database,
          brandId,
          {
            id: stagingProduct.existingProductId,
            name: stagingProduct.name,
            productHandle: stagingProduct.productHandle ?? undefined,
            description: stagingProduct.description ?? undefined,
            categoryId: stagingProduct.categoryId ?? undefined,
            seasonId: stagingProduct.seasonId ?? undefined,
            manufacturerId: stagingProduct.manufacturerId ?? undefined,
            primaryImagePath: stagingProduct.primaryImagePath ?? undefined,
            status: stagingProduct.status ?? undefined,
          },
        );

        if (!updated?.id) {
          throw new Error("Failed to update product");
        }

        productId = updated.id;
      }

      // Step 2: Create or update the product variant
      if (action === "CREATE") {
        const [createdVariant] = await tx
          .insert(productVariants)
          .values({
            id: variant.id,
            productId,
            colorId: variant.colorId ?? null,
            sizeId: variant.sizeId ?? null,
            upid: variant.upid,
          })
          .returning({ id: productVariants.id });

        if (!createdVariant?.id) {
          throw new Error("Failed to create variant");
        }

        variantId = createdVariant.id;
      } else {
        // UPDATE action
        if (!variant.existingVariantId) {
          throw new Error("UPDATE action missing existingVariantId");
        }

        const [updatedVariant] = await tx
          .update(productVariants)
          .set({
            colorId: variant.colorId ?? null,
            sizeId: variant.sizeId ?? null,
            upid: variant.upid ?? undefined,
          })
          .where(eq(productVariants.id, variant.existingVariantId))
          .returning({ id: productVariants.id });

        if (!updatedVariant?.id) {
          throw new Error("Failed to update variant");
        }

        variantId = updatedVariant.id;
      }
      coreDurationMs = Date.now() - coreStart;

      // Step 3: Upsert related tables (materials, eco claims, journey steps, environment)
      // Fetch and insert materials
      const relationsStart = Date.now();
      const stagingMaterials = stagingProduct.materials;
      if (stagingMaterials.length > 0) {
        await upsertProductMaterials(
          tx as unknown as Database,
          productId,
          stagingMaterials.map((m) => ({
            brandMaterialId: m.brandMaterialId,
            percentage: m.percentage || undefined,
          })),
        );
      }

      // Fetch and insert eco-claims
      const stagingEcoClaims = stagingProduct.ecoClaims;
      if (stagingEcoClaims.length > 0) {
        await setProductEcoClaims(
          tx as unknown as Database,
          productId,
          stagingEcoClaims.map((e) => e.ecoClaimId),
        );
      }

      // Fetch and insert journey steps
      const stagingJourneySteps = stagingProduct.journeySteps;
      if (stagingJourneySteps.length > 0) {
        await setProductJourneySteps(
          tx as unknown as Database,
          productId,
          stagingJourneySteps.map((s) => ({
            sortIndex: s.sortIndex,
            stepType: s.stepType,
            facilityId: s.facilityId,
          })),
        );
      }

      // Fetch and insert environment data
      const stagingEnvironment = stagingProduct.environment;
      if (stagingEnvironment) {
        await upsertProductEnvironment(tx as unknown as Database, productId, {
          carbonKgCo2e: stagingEnvironment.carbonKgCo2e || undefined,
          waterLiters: stagingEnvironment.waterLiters || undefined,
        });
      }

      // Step 4: Mark import_row as APPLIED
      await batchUpdateImportRowStatus(tx as unknown as Database, [
        {
          id: stagingProduct.stagingId, // Using stagingId as temporary lookup
          status: "APPLIED",
          normalized: {
            action,
            product_id: productId,
            variant_id: variantId,
          },
        },
      ]);

      importRowId = stagingProduct.stagingId;
      relationDurationMs = Date.now() - relationsStart;
    });

    // Removed per-row logging for performance - only log errors and batch summaries
    return {
      rowNumber,
      importRowId,
      action: action as "CREATE" | "UPDATE",
      success: true,
      productId,
      variantId,
    };
  } catch (error) {
    const rowDurationMs = Date.now() - rowStart;
    logger.error("Failed to commit staging row (transaction rolled back)", {
      rowNumber,
      action,
      rowDurationMs,
      coreDurationMs,
      relationDurationMs,
      error: error instanceof Error ? error.message : String(error),
    });

    // Mark import_row as FAILED (outside transaction)
    try {
      await batchUpdateImportRowStatus(db, [
        {
          id: stagingProduct.stagingId,
          status: "FAILED",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      ]);
    } catch (updateError) {
      logger.error("Failed to update import_row status", {
        rowNumber,
        error:
          updateError instanceof Error
            ? updateError.message
            : String(updateError),
      });
    }

    throw error;
  }
}

function summarizeTimings(
  totalDurationMs: number,
  batches: BatchTimingSnapshot[],
  cleanupMs?: number,
) {
  const batchCount = batches.length;
  const totalRows = batches.reduce((sum, batch) => sum + batch.rowCount, 0);
  const totalBatchMs = batches.reduce((sum, batch) => sum + batch.totalMs, 0);
  const totalProcessMs = batches.reduce(
    (sum, batch) => sum + batch.processMs,
    0,
  );
  const slowestBatch = batches.reduce<BatchTimingSnapshot | null>(
    (slowest, batch) => {
      if (!slowest || batch.totalMs > slowest.totalMs) {
        return batch;
      }
      return slowest;
    },
    null,
  );

  return {
    totalMs: totalDurationMs,
    batchCount,
    totalRows,
    averageBatchMs:
      batchCount > 0 ? Math.round(totalBatchMs / batchCount) : undefined,
    averageRowProcessMs:
      totalRows > 0 ? Math.round(totalProcessMs / totalRows) : undefined,
    slowestBatchMs: slowestBatch?.totalMs,
    slowestBatchNumber: slowestBatch?.batchNumber,
    cleanupMs,
    batches,
    rowConcurrency: ROW_CONCURRENCY,
    deleteChunkSize: STAGING_DELETE_CHUNK_SIZE,
  };
}

function resolveRowConcurrency(): number {
  const envValue = process.env.COMMIT_ROW_CONCURRENCY;
  const parsed = envValue ? Number.parseInt(envValue, 10) : Number.NaN;
  const base = Number.isNaN(parsed) ? 15 : parsed; // Ultra-optimized: 15 concurrent rows
  return Math.min(Math.max(base, 1), 20);
}

function resolveDeleteChunkSize(): number {
  const envValue = process.env.COMMIT_DELETE_CHUNK_SIZE;
  const parsed = envValue ? Number.parseInt(envValue, 10) : Number.NaN;
  const base = Number.isNaN(parsed) ? 500 : parsed;
  return Math.min(Math.max(base, 100), 5000);
}
