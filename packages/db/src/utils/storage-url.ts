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
/**
 * Bucket name for public certification documents.
 */
export const CERTIFICATIONS_BUCKET = "certifications";
const STORAGE_PUBLIC_PREFIX = "/storage/v1/object/public/";

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
 * Escape regex metacharacters for safe dynamic patterns.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Decode URI path segments safely.
 */
function decodePath(path: string): string {
  return path
    .split("/")
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join("/");
}

/**
 * Extract a storage object path from a full public storage URL.
 */
function extractStoragePathFromPublicUrl(
  value: string,
  bucket: string,
): string | null {
  const escapedBucket = escapeRegExp(bucket);
  const pattern = new RegExp(
    `${STORAGE_PUBLIC_PREFIX}${escapedBucket}/(.+?)(?:[?#].*)?$`,
    "i",
  );
  const match = value.match(pattern);
  if (!match?.[1]) return null;
  return decodePath(match[1]);
}

/**
 * Build a public URL for a storage object in a public bucket.
 *
 * @param storageBaseUrl - The Supabase storage base URL (e.g., https://xxx.supabase.co)
 * @param bucket - The public bucket name
 * @param objectPath - The storage path (e.g., brandId/products/file.pdf)
 * @returns Full public URL, or null if objectPath is null/empty
 */
export function buildPublicStorageUrl(
  storageBaseUrl: string | null | undefined,
  bucket: string,
  objectPath: string | null | undefined,
): string | null {
  if (!objectPath) return null;

  // Normalize legacy full public storage URLs back to a storage path first.
  const extractedStoragePath = extractStoragePathFromPublicUrl(
    objectPath,
    bucket,
  );
  const normalizedPath = extractedStoragePath ?? objectPath;

  // Preserve external full URLs as-is.
  if (isFullUrl(normalizedPath)) return normalizedPath;

  // If no storage base URL available, return the path as-is
  // (fallback for backward compatibility)
  if (!storageBaseUrl) {
    return extractedStoragePath ? objectPath : normalizedPath;
  }

  const normalizedStorageBaseUrl = storageBaseUrl.endsWith("/")
    ? storageBaseUrl.slice(0, -1)
    : storageBaseUrl;
  const encodedPath = encodePath(normalizedPath);
  return `${normalizedStorageBaseUrl}/storage/v1/object/public/${bucket}/${encodedPath}`;
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
  return buildPublicStorageUrl(storageBaseUrl, PRODUCTS_BUCKET, imagePath);
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
  // Prefer dedicated storage URL overrides, then fall back to Supabase URL.
  return (
    process.env.SUPABASE_STORAGE_URL ??
    process.env.NEXT_PUBLIC_STORAGE_URL ??
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    null
  );
}
