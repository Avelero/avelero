/**
 * DPP cache revalidation utility for background jobs.
 *
 * Provides functions to invalidate cached DPP pages when bulk operations complete.
 * Uses on-demand revalidation via the DPP app's /api/revalidate endpoint.
 *
 * Environment variables required:
 * - DPP_URL or NEXT_PUBLIC_DPP_URL: Base URL of the DPP app
 * - DPP_REVALIDATION_SECRET: Shared secret for authentication
 */

const DPP_URL = process.env.DPP_URL || process.env.NEXT_PUBLIC_DPP_URL;
const REVALIDATION_SECRET = process.env.DPP_REVALIDATION_SECRET;

// Timeout for revalidation requests (5 seconds)
const REVALIDATION_TIMEOUT_MS = 5_000;

/**
 * Revalidate DPP cache for specific tags.
 *
 * This function is fire-and-forget - it won't throw if revalidation fails,
 * as cache invalidation failure shouldn't break the main operation.
 *
 * @param tags - Array of cache tags to invalidate
 */
export async function revalidateDppCache(tags: string[]): Promise<void> {
  if (!DPP_URL) {
    console.warn(
      "[DPP Revalidation] DPP_URL not configured, skipping revalidation",
    );
    return;
  }

  if (!REVALIDATION_SECRET) {
    console.warn(
      "[DPP Revalidation] DPP_REVALIDATION_SECRET not configured, skipping revalidation",
    );
    return;
  }

  if (tags.length === 0) {
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REVALIDATION_TIMEOUT_MS);

  try {
    const response = await fetch(`${DPP_URL}/api/revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-revalidation-secret": REVALIDATION_SECRET,
      },
      body: JSON.stringify({ tags }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(
        `[DPP Revalidation] Request failed (${response.status}):`,
        errorText,
      );
      return;
    }

    const result = await response.json();
    console.log("[DPP Revalidation] Cache invalidated:", result);
  } catch (error) {
    clearTimeout(timeoutId);

    // Don't throw - revalidation failure shouldn't break the main operation
    if (error instanceof Error && error.name === "AbortError") {
      console.error(
        `[DPP Revalidation] Request timed out after ${REVALIDATION_TIMEOUT_MS}ms`,
      );
    } else {
      console.error("[DPP Revalidation] Failed:", error);
    }
  }
}

/**
 * Revalidate DPP cache for an entire brand.
 *
 * Call this after bulk imports complete to refresh all DPP pages for the brand.
 *
 * @param brandSlug - The brand's URL slug
 */
export function revalidateBrand(brandSlug: string): Promise<void> {
  if (!brandSlug) return Promise.resolve();
  return revalidateDppCache([`dpp-brand-${brandSlug}`]);
}

/**
 * Revalidate DPP cache for a list of published passports by UPID.
 *
 * These tags match the `dpp-passport-{upid}` tags applied at fetch time in
 * apps/dpp/src/lib/api.ts fetchPassportDpp(). Call this after publishing.
 *
 * Tags are sent in chunks to avoid hitting request size limits.
 *
 * @param upids - Array of UPIDs to invalidate
 */
export async function revalidatePassports(upids: string[]): Promise<void> {
  const filtered = upids.filter(Boolean);
  if (filtered.length === 0) return;
  const CHUNK_SIZE = 100;
  for (let i = 0; i < filtered.length; i += CHUNK_SIZE) {
    const chunk = filtered.slice(i, i + CHUNK_SIZE);
    await revalidateDppCache(chunk.map((upid) => `dpp-passport-${upid}`));
  }
}

/**
 * Revalidate DPP cache for a list of barcodes within a brand.
 *
 * These tags match the `dpp-barcode-{brandId}-{barcode}` tags applied at
 * fetch time in apps/dpp/src/lib/api.ts fetchPassportByBarcode(). Call this
 * after publishing variants that have barcodes.
 *
 * Tags are sent in chunks to avoid hitting request size limits.
 *
 * @param brandId - The brand UUID
 * @param barcodes - Array of barcodes to invalidate
 */
export async function revalidateBarcodes(
  brandId: string,
  barcodes: string[],
): Promise<void> {
  const filtered = barcodes.filter(Boolean);
  if (!brandId || filtered.length === 0) return;
  const CHUNK_SIZE = 100;
  for (let i = 0; i < filtered.length; i += CHUNK_SIZE) {
    const chunk = filtered.slice(i, i + CHUNK_SIZE);
    await revalidateDppCache(
      chunk.map((barcode) => `dpp-barcode-${brandId}-${barcode}`),
    );
  }
}
