/**
 * Background task for large product deletions.
 *
 * Processes a snapshotted delete job in chunks so large deletions do not run
 * inside a normal API request/response transaction.
 */

import "./configure-trigger";
import { logger, task } from "@trigger.dev/sdk/v3";
import { db } from "@v1/db/client";
import {
  claimProductDeleteJobChunk,
  completeProductDeleteJobChunk,
  deleteProductsChunk,
  getProductDeleteJobStatus,
  updateProductDeleteJobStatus,
} from "@v1/db/queries";
import { sendBulkBroadcast } from "@v1/db/utils";
import {
  revalidateBarcodes,
  revalidatePassports,
} from "../lib/dpp-revalidation";
import {
  PRODUCT_IMAGES_BUCKET,
  PRODUCT_QR_CODES_BUCKET,
  createStorageClient,
  getQrCachePathsForDeletedBarcodes,
  getRejectedSettledReasons,
  removeStoragePathsInBatches,
} from "../lib/product-storage-cleanup";

const DELETE_CHUNK_SIZE = 100;

interface DeleteProductsPayload {
  jobId: string;
  brandId: string;
}

export const deleteProducts = task({
  id: "delete-products",
  maxDuration: 1800,
  queue: { concurrencyLimit: 3 },
  retry: { maxAttempts: 1 },
  run: async (payload: DeleteProductsPayload): Promise<void> => {
    const { jobId, brandId } = payload;
    const storageSetup = createStorageClient();
    const storage = storageSetup.client;
    let processed = 0;
    let deleted = 0;

    logger.info("Starting product delete job", { jobId, brandId });

    if (!storage) {
      logger.warn(
        "Supabase env vars missing, skipping product delete storage cleanup",
        {
          jobId,
          brandId,
          hasUrl: storageSetup.hasUrl,
          hasServiceKey: storageSetup.hasServiceKey,
        },
      );
    }

    const existingJob = await getProductDeleteJobStatus(db, jobId);
    if (!existingJob) {
      logger.warn("Product delete job not found", { jobId, brandId });
      return;
    }

    await updateProductDeleteJobStatus(db, {
      jobId,
      status: "PROCESSING",
      summary: existingJob.summary ?? undefined,
    });

    try {
      while (true) {
        const productIds = await db.transaction((tx) =>
          claimProductDeleteJobChunk(tx, jobId, DELETE_CHUNK_SIZE),
        );

        if (productIds.length === 0) {
          break;
        }

        const chunk = await db.transaction((tx) =>
          deleteProductsChunk(tx, brandId, productIds, {
            suppressRealtimeBroadcast: true,
          }),
        );

        await completeProductDeleteJobChunk(db, jobId, productIds);
        processed += productIds.length;
        deleted += chunk.deleted;

        await updateProductDeleteJobStatus(db, {
          jobId,
          status: "PROCESSING",
          productsProcessed: processed,
          summary: {
            deleted,
          },
        });

        await Promise.allSettled([
          revalidatePassports(chunk.upids),
          revalidateBarcodes(brandId, chunk.barcodes),
        ]);

        if (storage) {
          const qrCachePaths = await getQrCachePathsForDeletedBarcodes(
            brandId,
            chunk.barcodes,
          );

          const storageCleanupResults = await Promise.allSettled([
            chunk.imagePaths.length > 0
              ? removeStoragePathsInBatches(
                  storage,
                  PRODUCT_IMAGES_BUCKET,
                  chunk.imagePaths,
                )
              : Promise.resolve(),
            qrCachePaths.length > 0
              ? removeStoragePathsInBatches(
                  storage,
                  PRODUCT_QR_CODES_BUCKET,
                  qrCachePaths,
                )
              : Promise.resolve(),
          ]);

          const storageCleanupFailures = getRejectedSettledReasons(
            storageCleanupResults,
          );
          if (storageCleanupFailures.length > 0) {
            logger.warn("Product delete storage cleanup failed", {
              jobId,
              brandId,
              failures: storageCleanupFailures,
            });
          }
        }
      }

      await updateProductDeleteJobStatus(db, {
        jobId,
        status: "COMPLETED",
        productsProcessed: processed,
        finishedAt: new Date().toISOString(),
        summary: {
          deleted,
        },
      });

      if ((existingJob.totalProducts ?? 0) > 0 || processed > 0) {
        await sendBulkBroadcast(db, {
          domain: "products",
          brandId,
          operation: "BULK_DELETE",
          summary: {
            deleted,
            total: processed,
          },
        });
      }

      logger.info("Completed product delete job", {
        jobId,
        brandId,
        processed,
        deleted,
      });
    } catch (error) {
      await updateProductDeleteJobStatus(db, {
        jobId,
        status: "FAILED",
        productsProcessed: processed,
        finishedAt: new Date().toISOString(),
        summary: {
          deleted,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      logger.error("Product delete job failed", {
        jobId,
        brandId,
        processed,
        deleted,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  },
});
