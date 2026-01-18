/**
 * Client-side storage URL utilities.
 *
 * Use these to construct display URLs from storage paths.
 * For server-side URL generation with Supabase client, use @v1/supabase/storage getPublicUrl().
 */

import { BUCKETS, type Bucket } from "./storage-config";

// ============================================================================
// Constants
// ============================================================================

const PUBLIC_BUCKETS = new Set<string>([
  BUCKETS.PRODUCTS,
  BUCKETS.DPP_ASSETS,
  BUCKETS.DPP_THEMES,
]);

const PRIVATE_BUCKETS = new Set<string>([
  BUCKETS.AVATARS,
  BUCKETS.BRAND_AVATARS,
]);

// ============================================================================
// URL Builders
// ============================================================================

/**
 * Encode a storage path for use in URLs.
 */
export function encodePath(path: string | string[]): string {
  const joined = Array.isArray(path) ? path.join("/") : path;
  return joined
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * Build a public URL for files in public buckets.
 * Use for: products, dpp-assets, dpp-themes
 */
export function buildPublicUrl(
  bucket: string,
  path: string | null | undefined,
): string | null {
  if (!path) return null;

  const supabaseUrl = getSupabaseUrl();
  const encodedPath = encodePath(path);

  if (supabaseUrl) {
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodedPath}`;
  }

  // Fallback for SSR or missing env var
  return `/storage/v1/object/public/${bucket}/${encodedPath}`;
}

/**
 * Build a proxy URL for files in private buckets.
 * Use for: avatars, brand-avatars (displayed in UI)
 */
export function buildProxyUrl(
  bucket: string,
  path: string | null | undefined,
): string | null {
  if (!path) return null;
  const encodedPath = encodePath(path);
  return `/api/storage/${bucket}/${encodedPath}`;
}

/**
 * Smart URL builder that chooses the right method based on bucket type.
 */
export function buildStorageUrl(
  bucket: Bucket,
  path: string | null | undefined,
): string | null {
  if (!path) return null;

  if (PUBLIC_BUCKETS.has(bucket)) {
    return buildPublicUrl(bucket, path);
  }

  if (PRIVATE_BUCKETS.has(bucket)) {
    return buildProxyUrl(bucket, path);
  }

  // Fallback to public URL for unknown buckets
  return buildPublicUrl(bucket, path);
}

// ============================================================================
// URL Detection / Normalization
// ============================================================================

/**
 * Check if a value is already a full URL (http/https/data/blob/api path).
 */
export function isFullUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^(https?:|data:|blob:|\/api\/|\/storage\/)/.test(value);
}

/**
 * Normalize a value that could be either a path or full URL to a display URL.
 * If it's already a full URL, returns as-is. Otherwise builds the appropriate URL.
 */
export function normalizeToDisplayUrl(
  bucket: Bucket,
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  if (isFullUrl(value)) return value;
  return buildStorageUrl(bucket, value);
}

/**
 * Extract the storage path from a value that could be a full URL or path.
 * Returns the path portion only.
 */
function extractPath(
  value: string | null | undefined,
  bucket: string,
): string | null {
  if (!value) return null;

  // If it doesn't look like a URL, assume it's already a path
  if (!isFullUrl(value)) return value;

  // Try to extract path from full URL
  try {
    const regex = new RegExp(`/${bucket}/(.+)$`);
    const match = value.match(regex);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

// ============================================================================
// Theme Config Image Resolution
// ============================================================================

/**
 * Resolve image paths in themeConfig to full public URLs.
 *
 * ThemeConfig stores storage PATHS (not full URLs) for images.
 * This function converts those paths to full URLs for display.
 *
 * This is the client-side equivalent of resolveThemeConfigImageUrls in the API router.
 * Used during live preview editing where themeConfigDraft contains raw paths.
 */
export function resolveThemeConfigImageUrls<T>(themeConfig: T): T {
  if (!themeConfig || typeof themeConfig !== "object") return themeConfig;

  // Deep clone to avoid mutating the original
  const resolved = JSON.parse(JSON.stringify(themeConfig)) as T & {
    branding?: { headerLogoUrl?: string };
    cta?: { bannerBackgroundImage?: string };
  };

  // Resolve branding.headerLogoUrl
  if (resolved.branding?.headerLogoUrl) {
    // Only resolve if it's a path (not already a full URL)
    if (!isFullUrl(resolved.branding.headerLogoUrl)) {
      resolved.branding.headerLogoUrl =
        buildPublicUrl(BUCKETS.DPP_ASSETS, resolved.branding.headerLogoUrl) ??
        "";
    }
  }

  // Resolve cta.bannerBackgroundImage
  if (resolved.cta?.bannerBackgroundImage) {
    // Only resolve if it's a path (not already a full URL)
    if (!isFullUrl(resolved.cta.bannerBackgroundImage)) {
      resolved.cta.bannerBackgroundImage =
        buildPublicUrl(
          BUCKETS.DPP_ASSETS,
          resolved.cta.bannerBackgroundImage,
        ) ?? "";
    }
  }

  return resolved;
}

// ============================================================================
// Environment Helpers
// ============================================================================

/**
 * Get the Supabase URL from environment.
 * NEXT_PUBLIC_ env vars are available on both client and server.
 */
export function getSupabaseUrl(): string | null {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
}
