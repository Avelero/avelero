/**
 * Shared storage cleanup helpers for product and brand deletion jobs.
 *
 * Centralizes QR cache key generation, storage client creation, and batched
 * storage object deletion so background delete entrypoints stay aligned.
 */

import { createHash } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { db } from "@v1/db/client";
import { eq } from "@v1/db/queries";
import { brandCustomDomains, qrExportJobs } from "@v1/db/schema";
import type { Database } from "@v1/supabase/types";

export const PRODUCT_IMAGES_BUCKET = "products";
export const PRODUCT_QR_CODES_BUCKET = "product-qr-codes";

const STORAGE_REMOVE_BATCH_SIZE = 1000;
const QR_CACHE_NAMESPACE = "00000000-0000-0000-0000-000000000000";
const QR_CACHE_KEY_VERSION = "v2";
const DEFAULT_QR_WIDTH = 1024;
const PRINT_QR_WIDTH = 2048;
const DEFAULT_QR_MARGIN = 1;
const DEFAULT_QR_ERROR_CORRECTION_LEVEL = "H";

export type StorageClient = ReturnType<typeof createSupabaseClient<Database>>;

export interface StorageClientResult {
  client: StorageClient | null;
  hasUrl: boolean;
  hasServiceKey: boolean;
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
 * Build a service-role Supabase client for storage cleanup.
 */
export function createStorageClient(): StorageClientResult {
  // Use the service role so background cleanup is not blocked by RLS.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    return {
      client: null,
      hasUrl: Boolean(url),
      hasServiceKey: Boolean(serviceKey),
    };
  }

  return {
    client: createSupabaseClient<Database>(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }),
    hasUrl: true,
    hasServiceKey: true,
  };
}

/**
 * Remove storage objects in manageable batches.
 */
export async function removeStoragePathsInBatches(
  supabase: StorageClient,
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
export async function getQrCachePathsForDeletedBarcodes(
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
 * Extract stringified reasons from a Promise.allSettled result array.
 */
export function getRejectedSettledReasons(
  results: PromiseSettledResult<unknown>[],
): string[] {
  // Normalize arbitrary rejection payloads into loggable strings.
  return results.flatMap((result) => {
    if (result.status !== "rejected") {
      return [];
    }

    return [
      result.reason instanceof Error
        ? result.reason.message
        : String(result.reason),
    ];
  });
}
