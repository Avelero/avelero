import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicUrl } from "@v1/supabase/storage";

const DPP_ASSETS_BUCKET = "dpp-assets";
const MAX_NORMALIZE_PASSES = 3;
const PASSPORT_SECTION_IMAGE_FIELDS = {
  banner: ["backgroundImage"],
  featureCards: ["cardOneImage", "cardTwoImage", "cardThreeImage"],
  textImage: ["image"],
} as const;

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

function extractBucketPath(value: string, bucket: string): string | null {
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
 * Resolve section image paths for known canvas and sidebar marketing blocks.
 */
function mapSectionImageFields(
  passport: Record<string, unknown>,
  mapper: (value: string) => string,
): void {
  for (const zoneKey of ["sidebar", "canvas"]) {
    const zone = passport[zoneKey];
    if (!Array.isArray(zone)) continue;

    for (const section of zone) {
      if (typeof section !== "object" || section === null) continue;
      const sec = section as Record<string, unknown>;
      const imageFields =
        PASSPORT_SECTION_IMAGE_FIELDS[
          sec.type as keyof typeof PASSPORT_SECTION_IMAGE_FIELDS
        ];

      if (!imageFields) continue;

      const content = sec.content as Record<string, unknown> | undefined;
      if (!content) continue;

      for (const imageField of imageFields) {
        const imageValue = content[imageField];
        if (typeof imageValue !== "string" || !imageValue) continue;
        content[imageField] = mapper(imageValue);
      }
    }
  }
}

/**
 * Resolve image storage paths in a Passport JSON to fully qualified public URLs.
 *
 * Walks:
 * - `header.logoUrl`
 * - Marketing section images in sidebar/canvas (`banner`, `featureCards`, `textImage`)
 */
export function resolvePassportImageUrls<
  T extends Record<string, unknown> | null,
>(supabase: SupabaseClient, passport: T): T {
  if (!passport) {
    return passport;
  }

  const resolved = JSON.parse(JSON.stringify(passport)) as Record<
    string,
    unknown
  >;

  // Resolve header logo
  const header = resolved.header as Record<string, unknown> | undefined;
  if (header && typeof header.logoUrl === "string" && header.logoUrl) {
    header.logoUrl = toPublicBucketUrl(
      supabase,
      DPP_ASSETS_BUCKET,
      header.logoUrl,
    );
  }

  mapSectionImageFields(resolved, (value) =>
    toPublicBucketUrl(supabase, DPP_ASSETS_BUCKET, value),
  );

  return resolved as T;
}

/**
 * Normalize Passport image URLs to storage paths before persisting.
 *
 * Walks the same paths as resolvePassportImageUrls.
 */
export function normalizePassportImagePathsForStorage<
  T extends Record<string, unknown>,
>(passport: T): T {
  const normalized = JSON.parse(JSON.stringify(passport)) as Record<
    string,
    unknown
  >;

  // Normalize header logo
  const header = normalized.header as Record<string, unknown> | undefined;
  if (header && typeof header.logoUrl === "string" && header.logoUrl) {
    header.logoUrl = toStoragePath(DPP_ASSETS_BUCKET, header.logoUrl);
  }

  mapSectionImageFields(normalized, (value) =>
    toStoragePath(DPP_ASSETS_BUCKET, value),
  );

  return normalized as T;
}
