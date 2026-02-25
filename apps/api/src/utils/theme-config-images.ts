import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicUrl } from "@v1/supabase/storage";

const DPP_ASSETS_BUCKET = "dpp-assets";
const MAX_NORMALIZE_PASSES = 3;

function isFullUrl(value: string): boolean {
  return /^(https?:|data:|blob:|\/api\/|\/storage\/)/.test(value);
}

function decodeStoragePath(path: string): string {
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractBucketPath(
  value: string,
  bucket: string,
): string | null {
  const escapedBucket = escapeRegExp(bucket);
  const pattern = new RegExp(
    `(?:https?:\\/\\/[^/]+)?\\/storage\\/v1\\/object\\/(?:public|sign)\\/${escapedBucket}\\/(.+?)(?:[?#].*)?$`,
    "i",
  );
  const match = value.match(pattern);
  if (!match?.[1]) {
    return null;
  }
  return decodeStoragePath(match[1]);
}

function normalizeBucketValue(value: string, bucket: string): string {
  let normalized = value.trim();

  for (let i = 0; i < MAX_NORMALIZE_PASSES; i++) {
    const extracted = extractBucketPath(normalized, bucket);
    if (!extracted || extracted === normalized) {
      break;
    }
    normalized = extracted;
  }

  return normalized;
}

function toPublicBucketUrl(
  supabase: SupabaseClient,
  bucket: string,
  value: string,
): string {
  const normalized = normalizeBucketValue(value, bucket);
  if (isFullUrl(normalized)) {
    return normalized;
  }
  return getPublicUrl(supabase, bucket, normalized) ?? normalized;
}

function toStoragePath(bucket: string, value: string): string {
  const normalized = normalizeBucketValue(value, bucket);
  if (isFullUrl(normalized)) {
    // Keep external URLs unchanged; only normalize known storage URLs to paths.
    return value.trim();
  }
  return normalized;
}

/**
 * Convert themeConfig image paths to fully qualified public URLs for response payloads.
 */
export function resolveThemeConfigImageUrls<
  T extends Record<string, unknown> | null,
>(supabase: SupabaseClient, themeConfig: T): T {
  if (!themeConfig) {
    return themeConfig;
  }

  const resolved = JSON.parse(JSON.stringify(themeConfig)) as Record<
    string,
    unknown
  >;

  if (
    resolved.branding &&
    typeof resolved.branding === "object" &&
    resolved.branding !== null
  ) {
    const branding = resolved.branding as Record<string, unknown>;
    if (typeof branding.headerLogoUrl === "string" && branding.headerLogoUrl) {
      branding.headerLogoUrl = toPublicBucketUrl(
        supabase,
        DPP_ASSETS_BUCKET,
        branding.headerLogoUrl,
      );
    }
  }

  if (resolved.cta && typeof resolved.cta === "object" && resolved.cta !== null) {
    const cta = resolved.cta as Record<string, unknown>;
    if (
      typeof cta.bannerBackgroundImage === "string" &&
      cta.bannerBackgroundImage
    ) {
      cta.bannerBackgroundImage = toPublicBucketUrl(
        supabase,
        DPP_ASSETS_BUCKET,
        cta.bannerBackgroundImage,
      );
    }
  }

  return resolved as T;
}

/**
 * Normalize themeConfig image URLs to storage paths before persisting.
 */
export function normalizeThemeConfigImagePathsForStorage<
  T extends Record<string, unknown>,
>(themeConfig: T): T {
  const normalized = JSON.parse(JSON.stringify(themeConfig)) as Record<
    string,
    unknown
  >;

  if (
    normalized.branding &&
    typeof normalized.branding === "object" &&
    normalized.branding !== null
  ) {
    const branding = normalized.branding as Record<string, unknown>;
    if (typeof branding.headerLogoUrl === "string" && branding.headerLogoUrl) {
      branding.headerLogoUrl = toStoragePath(
        DPP_ASSETS_BUCKET,
        branding.headerLogoUrl,
      );
    }
  }

  if (
    normalized.cta &&
    typeof normalized.cta === "object" &&
    normalized.cta !== null
  ) {
    const cta = normalized.cta as Record<string, unknown>;
    if (
      typeof cta.bannerBackgroundImage === "string" &&
      cta.bannerBackgroundImage
    ) {
      cta.bannerBackgroundImage = toStoragePath(
        DPP_ASSETS_BUCKET,
        cta.bannerBackgroundImage,
      );
    }
  }

  return normalized as T;
}
