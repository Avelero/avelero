/**
 * DPP cache revalidation utility.
 *
 * Provides functions to invalidate cached DPP pages when product/brand data changes.
 * Uses on-demand revalidation via the DPP app's /api/revalidate endpoint.
 *
 * Environment variables required:
 * - DPP_URL or NEXT_PUBLIC_DPP_URL: Base URL of the DPP app
 * - DPP_REVALIDATION_SECRET: Shared secret for authentication
 */

const DPP_URL = process.env.DPP_URL || process.env.NEXT_PUBLIC_DPP_URL;
const REVALIDATION_SECRET = process.env.DPP_REVALIDATION_SECRET;
const DEFAULT_TIMEOUT_MS =
  Number.parseInt(process.env.DPP_REVALIDATION_TIMEOUT_MS || "5000", 10) || 5000;

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
      console.warn(
        `[DPP Revalidation] Request timed out after ${timeoutMs}ms`,
      );
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
 * @param productUpid - The product's UPID (16-character identifier)
 */
export function revalidateProduct(productUpid: string): Promise<void> {
  if (!productUpid) return Promise.resolve();
  return revalidateDppCache([`dpp-product-${productUpid}`]);
}

/**
 * Revalidate DPP cache for a specific variant.
 *
 * Call this when a variant is created, updated, or deleted.
 * Also invalidates the parent product's cache.
 *
 * @param variantUpid - The variant's UPID (16-character identifier)
 * @param productUpid - The parent product's UPID (optional, for additional invalidation)
 */
export function revalidateVariant(
  variantUpid: string,
  productUpid?: string,
): Promise<void> {
  const tags: string[] = [];
  if (variantUpid) tags.push(`dpp-variant-${variantUpid}`);
  if (productUpid) tags.push(`dpp-product-${productUpid}`);
  if (tags.length === 0) return Promise.resolve();
  return revalidateDppCache(tags);
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
 * Revalidate DPP cache for multiple products at once.
 *
 * Useful for bulk operations like imports.
 *
 * @param productUpids - Array of product UPIDs to invalidate
 */
export function revalidateProducts(productUpids: string[]): Promise<void> {
  const validUpids = productUpids.filter(Boolean);
  if (validUpids.length === 0) return Promise.resolve();
  return revalidateDppCache(validUpids.map((upid) => `dpp-product-${upid}`));
}

