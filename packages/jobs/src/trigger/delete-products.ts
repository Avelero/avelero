/**
 * Background task for large product deletions.
 *
 * Processes a snapshotted delete job in chunks so large deletions do not run
 * inside a normal API request/response transaction.
 */

import "./configure-trigger";
import { createHash } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { logger, task } from "@trigger.dev/sdk/v3";
import { db } from "@v1/db/client";
import {
  claimProductDeleteJobChunk,
  completeProductDeleteJobChunk,
  deleteProductsChunk,
  eq,
  getProductDeleteJobStatus,
  updateProductDeleteJobStatus,
} from "@v1/db/queries";
import { brandCustomDomains, qrExportJobs } from "@v1/db/schema";
import { sendBulkBroadcast } from "@v1/db/utils";
import type { Database } from "@v1/supabase/types";
import {
  revalidateBarcodes,
  revalidatePassports,
} from "../lib/dpp-revalidation";

const PRODUCT_IMAGES_BUCKET = "products";
const PRODUCT_QR_CODES_BUCKET = "product-qr-codes";
const STORAGE_REMOVE_BATCH_SIZE = 1000;
const DELETE_CHUNK_SIZE = 100;
const QR_CACHE_NAMESPACE = "00000000-0000-0000-0000-000000000000";
const QR_CACHE_KEY_VERSION = "v2";
const DEFAULT_QR_WIDTH = 1024;
const PRINT_QR_WIDTH = 2048;
const DEFAULT_QR_MARGIN = 1;
const DEFAULT_QR_ERROR_CORRECTION_LEVEL = "H";

interface DeleteProductsPayload {
  jobId: string;
  brandId: string;
}

/**
 * Normalize a domain string for QR cache key generation.
 */
function normalizeDomain(domain: string): string {
  // Match the API router's QR cache normalization logic.
  return domain
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/g, "")
    .toLowerCase();
}

/**
 * Build one QR cache filename.
 */
function buildQrPngCacheFilename(
  domain: string,
  barcode: string,
  width: number,
): string {
  // Keep cache key generation identical across API and worker paths.
  const key = [
    QR_CACHE_KEY_VERSION,
    normalizeDomain(domain),
    barcode.trim(),
    String(width),
    String(DEFAULT_QR_MARGIN),
    DEFAULT_QR_ERROR_CORRECTION_LEVEL,
  ].join("|");

  return `${createHash("sha256").update(key).digest("hex")}.png`;
}

/**
 * Build both QR cache paths for one domain/barcode pair.
 */
function buildQrCachePath(
  brandId: string,
  domain: string,
  barcode: string,
): string[] {
  // Generate the same pair of cached PNG paths as the API router.
  const normalizedDomain = normalizeDomain(domain);
  const normalizedBarcode = barcode.trim();

  return [DEFAULT_QR_WIDTH, PRINT_QR_WIDTH].map((width) => {
    const filename = buildQrPngCacheFilename(
      normalizedDomain,
      normalizedBarcode,
      width,
    );
    return `${brandId}/${QR_CACHE_NAMESPACE}/${filename}`;
  });
}

/**
 * Remove storage objects in manageable batches.
 */
async function removeStoragePathsInBatches(
  supabase: ReturnType<typeof createSupabaseClient<Database>>,
  bucket: string,
  paths: string[],
): Promise<void> {
  // Chunk deletes to stay under storage API payload limits.
  for (let i = 0; i < paths.length; i += STORAGE_REMOVE_BATCH_SIZE) {
    const chunk = paths.slice(i, i + STORAGE_REMOVE_BATCH_SIZE);
    if (chunk.length === 0) {
      continue;
    }

    const { error } = await supabase.storage.from(bucket).remove(chunk);
    if (error) {
      throw new Error(error.message);
    }
  }
}

/**
 * Compute QR cache paths for deleted barcodes across current and historical domains.
 */
async function getQrCachePathsForDeletedBarcodes(
  brandId: string,
  barcodes: string[],
): Promise<string[]> {
  // Include both the live domain and historical QR export domains.
  if (barcodes.length === 0) {
    return [];
  }

  const [currentDomainRows, historicalDomainRows] = await Promise.all([
    db
      .select({ domain: brandCustomDomains.domain })
      .from(brandCustomDomains)
      .where(eq(brandCustomDomains.brandId, brandId)),
    db
      .selectDistinct({ domain: qrExportJobs.customDomain })
      .from(qrExportJobs)
      .where(eq(qrExportJobs.brandId, brandId)),
  ]);

  const domains = Array.from(
    new Set(
      [...currentDomainRows, ...historicalDomainRows]
        .map((row) => normalizeDomain(row.domain))
        .filter((domain) => domain.length > 0),
    ),
  );

  if (domains.length === 0) {
    return [];
  }

  const paths = new Set<string>();
  for (const domain of domains) {
    for (const barcode of barcodes) {
      for (const path of buildQrCachePath(brandId, domain, barcode)) {
        paths.add(path);
      }
    }
  }

  return Array.from(paths);
}

/**
 * Build a service-role Supabase client for storage cleanup.
 */
function createStorageClient() {
  // Use the service role so background cleanup is not blocked by RLS.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    return null;
  }

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export const deleteProducts = task({
  id: "delete-products",
  maxDuration: 1800,
  queue: { concurrencyLimit: 3 },
  retry: { maxAttempts: 1 },
  run: async (payload: DeleteProductsPayload): Promise<void> => {
    const { jobId, brandId } = payload;
    const storage = createStorageClient();
    let processed = 0;
    let deleted = 0;

    logger.info("Starting product delete job", { jobId, brandId });

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

          await Promise.allSettled([
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
