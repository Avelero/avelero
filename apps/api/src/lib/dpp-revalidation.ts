/**
 * DPP cache revalidation utility.
 *
 * Provides functions to invalidate cached DPP pages when product/brand data changes.
 * Uses on-demand revalidation via the DPP app's /api/revalidate endpoint.
 *
 * Cache tag naming conventions:
 * - `dpp-passport-{upid}` - Per-passport invalidation (primary, matches DPP fetch tags)
 * - `dpp-barcode-{brandId}-{barcode}` - Per-barcode invalidation (matches DPP fetch tags)
 * - `dpp-product-{productHandle}` - Per-product invalidation (legacy)
 * - `dpp-brand-{brandSlug}` - Brand-wide invalidation (bulk fallback)
 *
 * Environment variables required:
 * - DPP_URL or NEXT_PUBLIC_DPP_URL: Base URL of the DPP app
 * - DPP_REVALIDATION_SECRET: Shared secret for authentication
 */

const DPP_URL = process.env.DPP_URL || process.env.NEXT_PUBLIC_DPP_URL;
const REVALIDATION_SECRET = process.env.DPP_REVALIDATION_SECRET;
const DEFAULT_TIMEOUT_MS =
  Number.parseInt(process.env.DPP_REVALIDATION_TIMEOUT_MS || "5000", 10) ||
  5000;

/**
 * Revalidate DPP cache for specific tags.
 *
 * This function is fire-and-forget - it won't throw if revalidation fails,
 * as cache invalidation failure shouldn't break the main operation.
 *
 * @param tags - Array of cache tags to invalidate
 * @param timeoutMs - Request timeout in milliseconds (default: 5000ms)
 */
export async function revalidateDppCache(
  tags: string[],
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<void> {
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
  }, timeoutMs);

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

    // Handle abort errors specifically - these are expected when timeout occurs
    if (error instanceof Error && error.name === "AbortError") {
      console.warn(`[DPP Revalidation] Request timed out after ${timeoutMs}ms`);
      return;
    }

    // Don't throw - revalidation failure shouldn't break the main operation
    // Only log non-abort errors
    console.error("[DPP Revalidation] Failed:", error);
  }
}

/**
 * Revalidate DPP cache for a specific product.
 *
 * Call this when a product is created, updated, or deleted.
 *
 * @param productHandle - The product's handle (URL-friendly identifier)
 */
export function revalidateProduct(productHandle: string): Promise<void> {
  if (!productHandle) return Promise.resolve();
  return revalidateDppCache([`dpp-product-${productHandle}`]);
}

/**
 * Revalidate DPP cache for an entire brand.
 *
 * Call this when:
 * - Brand theme is updated
 * - Brand slug is changed
 * - Bulk import is completed
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
