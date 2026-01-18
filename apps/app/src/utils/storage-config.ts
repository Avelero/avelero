/**
 * Storage bucket configuration for the app.
 *
 * Bucket names and validation rules for different asset types.
 * Use with the generic upload() from @v1/supabase/storage.
 */

// ============================================================================
// Bucket Names
// ============================================================================

export const BUCKETS = {
  // Private buckets (use proxy or signed URLs)
  AVATARS: "avatars",
  BRAND_AVATARS: "brand-avatars",
  PRODUCT_IMPORTS: "product-imports",

  // Public buckets (use getPublicUrl)
  PRODUCTS: "products",
  DPP_ASSETS: "dpp-assets",
  DPP_THEMES: "dpp-themes",
} as const;

export type Bucket = (typeof BUCKETS)[keyof typeof BUCKETS];

// ============================================================================
// MIME Type Constants
// ============================================================================

const IMAGE_MIME = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

const LOGO_MIME = [...IMAGE_MIME, "image/svg+xml"] as const;

// Font MIME types are inconsistent across browsers, so we include multiple variants
const FONT_MIME = [
  "font/woff2",
  "font/woff",
  "font/ttf",
  "font/otf",
  "application/font-woff2",
  "application/font-woff",
  "application/x-font-ttf",
  "application/x-font-opentype",
  "application/octet-stream", // Some browsers report this for fonts
] as const;

// ============================================================================
// Upload Configs
// ============================================================================

export const UPLOAD_CONFIGS = {
  productImage: {
    bucket: BUCKETS.PRODUCTS,
    maxBytes: 10 * 1024 * 1024, // 10MB
    allowedMime: IMAGE_MIME,
    isPublic: true,
  },
  logo: {
    bucket: BUCKETS.DPP_ASSETS,
    maxBytes: 2 * 1024 * 1024, // 2MB
    allowedMime: LOGO_MIME,
    isPublic: true,
  },
  banner: {
    bucket: BUCKETS.DPP_ASSETS,
    maxBytes: 5 * 1024 * 1024, // 5MB
    allowedMime: IMAGE_MIME,
    isPublic: true,
  },
  avatar: {
    bucket: BUCKETS.AVATARS,
    maxBytes: 4 * 1024 * 1024, // 4MB
    allowedMime: IMAGE_MIME,
    isPublic: false,
  },
  brandAvatar: {
    bucket: BUCKETS.BRAND_AVATARS,
    maxBytes: 4 * 1024 * 1024, // 4MB
    allowedMime: IMAGE_MIME,
    isPublic: false,
  },
  font: {
    bucket: BUCKETS.DPP_ASSETS,
    maxBytes: 10 * 1024 * 1024, // 10MB
    allowedMime: FONT_MIME,
    isPublic: true,
  },
} as const;

export type UploadConfigKey = keyof typeof UPLOAD_CONFIGS;
type UploadConfig = (typeof UPLOAD_CONFIGS)[UploadConfigKey];

// ============================================================================
// Path Builders
// ============================================================================

export const buildStoragePath = {
  productImage: (brandId: string, productId: string, filename: string) =>
    `${brandId}/products/${productId}/${filename}`,

  dppAsset: (
    brandId: string,
    folder: "header-logo" | "banner" | "assets",
    filename: string,
  ) => `${brandId}/${folder}/${filename}`,

  themeStylesheet: (brandId: string) => `${brandId}/theme.css`,

  avatar: (userId: string, filename: string) => `${userId}/${filename}`,

  brandAvatar: (brandId: string, filename: string) => `${brandId}/${filename}`,

  font: (brandId: string, filename: string) => `${brandId}/fonts/${filename}`,
};

// ============================================================================
// URL Helpers
// ============================================================================

/**
 * Extract the storage path from a public Supabase URL.
 *
 * Example input: https://xxx.supabase.co/storage/v1/object/public/dpp-assets/brand-123/logo.png
 * Returns: brand-123/logo.png
 */
function extractPathFromUrl(url: string, bucket: string): string | null {
  try {
    const regex = new RegExp(`/${bucket}/(.+)$`);
    const match = url.match(regex);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
