/**
 * Storage URL Utilities.
 *
 * Build public URLs for Supabase storage objects.
 * Used during snapshot generation to create permanent, accessible URLs.
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Bucket name for product images.
 */
export const PRODUCTS_BUCKET = "products";

// =============================================================================
// URL BUILDING
// =============================================================================

/**
 * Encode a storage path for use in URLs.
 */
function encodePath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * Build a public URL for a product image.
 *
 * @param storageBaseUrl - The Supabase storage base URL (e.g., https://xxx.supabase.co)
 * @param imagePath - The storage path (e.g., brandId/products/productId/filename.jpg)
 * @returns Full public URL, or null if imagePath is null/empty
 */
export function buildProductImageUrl(
  storageBaseUrl: string | null | undefined,
  imagePath: string | null | undefined,
): string | null {
  if (!imagePath) return null;

  // If already a full URL, return as-is
  if (isFullUrl(imagePath)) return imagePath;

  // If no storage base URL available, return the path as-is
  // (fallback for backward compatibility)
  if (!storageBaseUrl) return imagePath;

  const encodedPath = encodePath(imagePath);
  return `${storageBaseUrl}/storage/v1/object/public/${PRODUCTS_BUCKET}/${encodedPath}`;
}

/**
 * Check if a value is already a full URL.
 */
export function isFullUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^(https?:|data:|blob:)/.test(value);
}

/**
 * Get the Supabase URL from environment.
 * Works in both Node.js and edge contexts.
 */
export function getSupabaseUrlFromEnv(): string | null {
  // Try common environment variable names
  return (
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null
  );
}
