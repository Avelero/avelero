/**
 * Trigger.dev task for hard-deleting brands and their cascading product data.
 */

import "./configure-trigger";
import { createHash } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { logger, task } from "@trigger.dev/sdk/v3";
import { db } from "@v1/db/client";
import { eq } from "@v1/db/index";
import {
  type DeleteProductsChunkResult,
  deleteProductsChunk,
} from "@v1/db/queries/products";
import {
  brandCustomDomains,
  brands,
  products,
  qrExportJobs,
} from "@v1/db/schema";
import type { Database } from "@v1/supabase/types";
import {
  revalidateBarcodes,
  revalidatePassports,
} from "../lib/dpp-revalidation";

/**
 * Task payload for brand deletion
 */
interface DeleteBrandPayload {
  brandId: string;
  userId: string;
}

const BATCH_SIZE = 1000;
const MAX_DURATION_SECONDS = 1800; // 30 minutes
const PRODUCT_IMAGES_BUCKET = "products";
const PRODUCT_QR_CODES_BUCKET = "product-qr-codes";
const STORAGE_REMOVE_BATCH_SIZE = 1000;
const QR_CACHE_NAMESPACE = "00000000-0000-0000-0000-000000000000";
const QR_CACHE_KEY_VERSION = "v2";
const DEFAULT_QR_WIDTH = 1024;
const PRINT_QR_WIDTH = 2048;
const DEFAULT_QR_MARGIN = 1;
const DEFAULT_QR_ERROR_CORRECTION_LEVEL = "H";

/**
 * Normalize a domain string for QR cache key generation.
 */
function normalizeDomain(domain: string): string {
  // Match the QR cache key generation used by the API and background delete task.
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
  // Keep the cache key stable between all delete entrypoints.
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
 * Build the QR cache paths for one domain/barcode pair.
 */
function buildQrCachePath(
  brandId: string,
  domain: string,
  barcode: string,
): string[] {
  // Generate both cached PNG widths for one barcode lookup path.
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
 * Background job for deleting a brand and all its associated data.
 *
 * This job handles the heavy lifting of deleting large amounts of data
 * without blocking the user's request. The brand is already soft-deleted
 * (deleted_at is set) when this job runs.
 *
 * Process:
 * 1. Delete products in batches (cascades handle variants, materials, etc.)
 * 2. Clean up storage files (brand avatars, product images)
 * 3. Hard-delete the brand row
 */
export const deleteBrand = task({
  id: "delete-brand",
  maxDuration: MAX_DURATION_SECONDS,
  queue: {
    concurrencyLimit: 2, // Limit concurrent brand deletions
  },
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 10000,
    maxTimeoutInMs: 120000,
    factor: 2,
    randomize: true,
  },
  run: async (payload: DeleteBrandPayload): Promise<void> => {
    const { brandId, userId } = payload;
    const jobStartTime = Date.now();
    const storage =
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
        ? createSupabaseClient<Database>(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY,
            {
              auth: {
                autoRefreshToken: false,
                persistSession: false,
              },
            },
          )
        : null;

    logger.info("Starting brand deletion job", { brandId, userId });

    try {
      // Verify brand exists and is soft-deleted
      const [brand] = await db
        .select({
          id: brands.id,
          deletedAt: brands.deletedAt,
          slug: brands.slug,
        })
        .from(brands)
        .where(eq(brands.id, brandId))
        .limit(1);

      if (!brand) {
        logger.warn("Brand not found, may have been deleted already", {
          brandId,
        });
        return;
      }

      if (!brand.deletedAt) {
        logger.error("Brand is not soft-deleted, aborting", { brandId });
        throw new Error(
          "Brand must be soft-deleted before background deletion",
        );
      }

      // Step 1: Delete products in batches
      let totalProductsDeleted = 0;
      let hasMoreProducts = true;
      let batchNumber = 1;

      while (hasMoreProducts) {
        // Get batch of product IDs
        const productBatch = await db
          .select({ id: products.id })
          .from(products)
          .where(eq(products.brandId, brandId))
          .limit(BATCH_SIZE);

        if (productBatch.length === 0) {
          hasMoreProducts = false;
          break;
        }

        const productIds = productBatch.map((p) => p.id);
        const chunk: DeleteProductsChunkResult = await db.transaction((tx) =>
          deleteProductsChunk(tx, brandId, productIds),
        );

        totalProductsDeleted += chunk.deleted;

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

        logger.info("Deleted product batch", {
          brandId,
          batchNumber,
          batchSize: chunk.deleted,
          totalDeleted: totalProductsDeleted,
        });

        batchNumber++;

        // Safety check: if we've been running too long, let the retry handle it
        const elapsedMs = Date.now() - jobStartTime;
        if (elapsedMs > (MAX_DURATION_SECONDS - 60) * 1000) {
          logger.warn("Approaching max duration, will continue on retry", {
            brandId,
            elapsedMs,
            totalDeleted: totalProductsDeleted,
          });
          throw new Error("Job approaching timeout, will retry to continue");
        }
      }

      logger.info("All products deleted", {
        brandId,
        totalProductsDeleted,
        durationMs: Date.now() - jobStartTime,
      });

      // Step 2: Clean up storage files
      await cleanupBrandStorage(brandId);

      // Step 3: Hard-delete the brand row
      // (cascades handle brand_members, brand_invites, brand catalog tables)
      const [deletedBrand] = await db
        .delete(brands)
        .where(eq(brands.id, brandId))
        .returning({ id: brands.id });

      if (!deletedBrand) {
        logger.warn("Brand row not found during hard delete", { brandId });
      }

      const totalDurationMs = Date.now() - jobStartTime;
      logger.info("Brand deletion completed", {
        brandId,
        totalProductsDeleted,
        totalDurationMs,
        avgMsPerProduct:
          totalProductsDeleted > 0
            ? Math.round(totalDurationMs / totalProductsDeleted)
            : 0,
      });
    } catch (error) {
      logger.error("Brand deletion job failed", {
        brandId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        durationMs: Date.now() - jobStartTime,
      });
      throw error;
    }
  },
});

/**
 * Clean up storage files associated with the brand.
 * Removes brand avatars and any other brand-specific storage.
 */
async function cleanupBrandStorage(brandId: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    logger.warn("Supabase env vars missing, skipping storage cleanup", {
      brandId,
      hasUrl: !!url,
      hasKey: !!serviceKey,
    });
    return;
  }

  const supabase = createSupabaseClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Clean up brand avatars
    const { data: avatarFiles } = await supabase.storage
      .from("brand-avatars")
      .list(brandId);

    if (avatarFiles && avatarFiles.length > 0) {
      const avatarPaths = avatarFiles.map((file) => `${brandId}/${file.name}`);
      const { error: avatarError } = await supabase.storage
        .from("brand-avatars")
        .remove(avatarPaths);

      if (avatarError) {
        logger.warn("Failed to delete brand avatars", {
          brandId,
          error: avatarError.message,
        });
      } else {
        logger.info("Deleted brand avatars", {
          brandId,
          count: avatarPaths.length,
        });
      }
    }

    // Clean up product images (if stored per-brand)
    const { data: productImages } = await supabase.storage
      .from("product-images")
      .list(brandId);

    if (productImages && productImages.length > 0) {
      // Product images might be nested, so we need recursive listing
      // For now, delete top-level files; a more thorough cleanup could be added
      const imagePaths = productImages.map((file) => `${brandId}/${file.name}`);
      const { error: imageError } = await supabase.storage
        .from("product-images")
        .remove(imagePaths);

      if (imageError) {
        logger.warn("Failed to delete product images", {
          brandId,
          error: imageError.message,
        });
      } else {
        logger.info("Deleted product images", {
          brandId,
          count: imagePaths.length,
        });
      }
    }
  } catch (error) {
    // Storage cleanup is best-effort; don't fail the job
    logger.error("Storage cleanup failed", {
      brandId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
