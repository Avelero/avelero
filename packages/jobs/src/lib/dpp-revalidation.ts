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

  try {
    const response = await fetch(`${DPP_URL}/api/revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-revalidation-secret": REVALIDATION_SECRET,
      },
      body: JSON.stringify({ tags }),
    });

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
    // Don't throw - revalidation failure shouldn't break the main operation
    console.error("[DPP Revalidation] Failed:", error);
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
