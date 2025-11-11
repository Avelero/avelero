import "./configure-trigger";
import { logger, task } from "@trigger.dev/sdk";
import { db } from "@v1/db/client";
import type { Database } from "@v1/db/client";
import {
  type StagingProductPreview,
  batchUpdateImportRowStatus,
  createProduct,
  createVariant,
  deleteStagingDataForJob,
  getImportJobStatus,
  getStagingProductsForCommit,
  getStagingMaterialsForProduct,
  getStagingEcoClaimsForProduct,
  getStagingJourneyStepsForProduct,
  getStagingEnvironmentForProduct,
  updateImportJobProgress,
  updateImportJobStatus,
  updateProduct,
  updateVariant,
  upsertProductMaterials,
  setProductEcoClaims,
  setProductJourneySteps,
  upsertProductEnvironment,
} from "@v1/db/queries";
// import { websocketManager } from "@v1/api/lib/websocket-manager";

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

const BATCH_SIZE = 100;
const TIMEOUT_MS = 1800000; // 30 minutes

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
  run: async (payload: CommitToProductionPayload): Promise<void> => {
    const { jobId, brandId } = payload;

    logger.info("Starting commit-to-production job", {
      jobId,
      brandId,
    });

    try {
      // Update job status to COMMITTING
      await updateImportJobStatus(db, {
        jobId,
        status: "COMMITTING",
      });

      // Get total count of staging products
      const job = await getImportJobStatus(db, jobId);
      if (!job) {
        throw new Error(`Import job ${jobId} not found`);
      }

      // Verify job status is VALIDATED
      if (job.status !== "VALIDATED") {
        throw new Error(
          `Cannot commit job with status ${job.status}. Job must be in VALIDATED status.`,
        );
      }

      const totalRows =
        ((job.summary as Record<string, unknown>)?.total as number) || 0;
      let processedCount = 0;
      let createdCount = 0;
      let updatedCount = 0;
      let failedCount = 0;
      const failedRowIds: string[] = [];

      logger.info("Starting production commit", {
        jobId,
        totalRows,
      });

      // Process staging data in batches
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        // Load batch from staging tables
        const stagingBatch = await getStagingProductsForCommit(
          db,
          jobId,
          BATCH_SIZE,
          offset,
        );

        if (stagingBatch.length === 0) {
          hasMore = false;
          break;
        }

        logger.info(`Processing batch starting at offset ${offset}`, {
          batchSize: stagingBatch.length,
          processedCount,
          totalRows,
        });

        // Process batch within a transaction
        const batchResults = await processBatch(
          db,
          brandId,
          stagingBatch,
          jobId,
        );

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

        // Update job progress
        await updateImportJobProgress(db, {
          jobId,
          summary: {
            total: totalRows,
            processed: processedCount,
            created: createdCount,
            updated: updatedCount,
            failed: failedCount,
            percentage: Math.round((processedCount / totalRows) * 100),
          },
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
          batchNumber: Math.floor(offset / BATCH_SIZE) + 1,
          processedCount,
          createdCount,
          updatedCount,
          failedCount,
        });

        offset += BATCH_SIZE;
      }

      // Clean up staging data
      logger.info("Cleaning up staging data", { jobId });
      const deletedCount = await deleteStagingDataForJob(db, jobId);
      logger.info("Staging data cleaned up", {
        jobId,
        deletedCount,
      });

      // Update job status to COMPLETED
      await updateImportJobStatus(db, {
        jobId,
        status: "COMPLETED",
        finishedAt: new Date().toISOString(),
        summary: {
          total: totalRows,
          created: createdCount,
          updated: updatedCount,
          failed: failedCount,
        },
      });

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

      logger.info("Production commit completed successfully", {
        jobId,
        total: totalRows,
        created: createdCount,
        updated: updatedCount,
        failed: failedCount,
      });
    } catch (error) {
      logger.error("Production commit job failed", {
        jobId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Clean up staging data even on failure to prevent orphaned records
      try {
        logger.info("Cleaning up staging data after failure", { jobId });
        const deletedCount = await deleteStagingDataForJob(db, jobId);
        logger.info("Staging data cleaned up after failure", {
          jobId,
          deletedCount,
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
        },
      });

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

  // Process each row individually with its own transaction
  // This allows partial success - some rows can fail while others succeed
  for (const stagingProduct of stagingBatch) {
    try {
      const result = await commitStagingRow(db, brandId, stagingProduct, jobId);
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

  return results;
}

/**
 * Commit a single staging row to production tables
 *
 * @param db - Database instance
 * @param brandId - Brand ID for authorization
 * @param stagingProduct - Staging product to commit
 * @param jobId - Import job ID
 * @returns Commit result
 */
async function commitStagingRow(
  db: Database,
  brandId: string,
  stagingProduct: StagingProductPreview,
  jobId: string,
): Promise<CommitRowResult> {
  const { action, rowNumber, variant } = stagingProduct;

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
      if (action === "CREATE") {
        const created = await createProduct(
          tx as unknown as Database,
          brandId,
          {
            name: stagingProduct.name,
            description: stagingProduct.description || undefined,
            categoryId: stagingProduct.categoryId || undefined,
            season: stagingProduct.season || undefined, // Legacy: kept for backward compatibility
            seasonId: stagingProduct.seasonId || undefined,
            brandCertificationId:
              stagingProduct.brandCertificationId || undefined,
            showcaseBrandId: stagingProduct.showcaseBrandId || undefined,
            primaryImageUrl: stagingProduct.primaryImageUrl || undefined,
            additionalImageUrls: stagingProduct.additionalImageUrls || undefined,
            tags: stagingProduct.tags || undefined,
          },
        );

        if (!created?.id) {
          throw new Error("Failed to create product");
        }

        productId = created.id;
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
            description: stagingProduct.description,
            categoryId: stagingProduct.categoryId,
            season: stagingProduct.season, // Legacy: kept for backward compatibility
            seasonId: stagingProduct.seasonId,
            brandCertificationId: stagingProduct.brandCertificationId,
            showcaseBrandId: stagingProduct.showcaseBrandId,
            primaryImageUrl: stagingProduct.primaryImageUrl,
            additionalImageUrls: stagingProduct.additionalImageUrls,
            tags: stagingProduct.tags,
          },
        );

        if (!updated?.id) {
          throw new Error("Failed to update product");
        }

        productId = updated.id;
      }

      // Step 2: Create or update the product variant
      if (action === "CREATE") {
        const createdVariant = await createVariant(
          tx as unknown as Database,
          productId,
          {
            sku: variant.sku || "",
            ean: variant.ean || undefined,
            upid: variant.upid || undefined,
            status: variant.status || undefined,
            colorId: variant.colorId || undefined,
            sizeId: variant.sizeId || undefined,
            productImageUrl: variant.productImageUrl || undefined,
          },
        );

        if (!createdVariant?.id) {
          throw new Error("Failed to create variant");
        }

        variantId = createdVariant.id;
      } else {
        // UPDATE action
        if (!variant.existingVariantId) {
          throw new Error("UPDATE action missing existingVariantId");
        }

        const updatedVariant = await updateVariant(
          tx as unknown as Database,
          variant.existingVariantId,
          {
            sku: variant.sku ?? undefined,
            ean: variant.ean ?? undefined,
            upid: variant.upid ?? undefined,
            status: variant.status ?? undefined,
            colorId: variant.colorId ?? undefined,
            sizeId: variant.sizeId ?? undefined,
            productImageUrl: variant.productImageUrl ?? undefined,
          },
        );

        if (!updatedVariant?.id) {
          throw new Error("Failed to update variant");
        }

        variantId = updatedVariant.id;
      }

      // Step 3: Upsert related tables (materials, eco claims, journey steps, environment)
      // Fetch and insert materials
      const stagingMaterials = await getStagingMaterialsForProduct(
        tx as unknown as Database,
        stagingProduct.stagingId,
      );
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
      const stagingEcoClaims = await getStagingEcoClaimsForProduct(
        tx as unknown as Database,
        stagingProduct.stagingId,
      );
      if (stagingEcoClaims.length > 0) {
        await setProductEcoClaims(
          tx as unknown as Database,
          productId,
          stagingEcoClaims.map((e) => e.ecoClaimId),
        );
      }

      // Fetch and insert journey steps
      const stagingJourneySteps = await getStagingJourneyStepsForProduct(
        tx as unknown as Database,
        stagingProduct.stagingId,
      );
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
      const stagingEnvironment = await getStagingEnvironmentForProduct(
        tx as unknown as Database,
        stagingProduct.stagingId,
      );
      if (stagingEnvironment) {
        await upsertProductEnvironment(
          tx as unknown as Database,
          productId,
          {
            carbonKgCo2e: stagingEnvironment.carbonKgCo2e || undefined,
            waterLiters: stagingEnvironment.waterLiters || undefined,
          },
        );
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
    });

    logger.info("Successfully committed staging row", {
      rowNumber,
      action,
      productId,
      variantId,
    });

    return {
      rowNumber,
      importRowId,
      action: action as "CREATE" | "UPDATE",
      success: true,
      productId,
      variantId,
    };
  } catch (error) {
    logger.error("Failed to commit staging row (transaction rolled back)", {
      rowNumber,
      action,
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
