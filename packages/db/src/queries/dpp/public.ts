/**
 * Public DPP Query - UPID-based Snapshot Fetching
 *
 * This module provides the UPID-based passport lookup that reads from
 * the immutable publishing layer (snapshots).
 *
 * URL Structure: passport.avelero.com/{upid}
 *
 * Benefits:
 * - Single UPID lookup (no brand slug or product handle)
 * - Reads from pre-computed snapshots (faster, simpler)
 * - Still fetches theme data from brand-level tables
 * - Handles inactive passports (variant deleted but snapshot preserved)
 */

import { eq } from "drizzle-orm";
import type { Database } from "../../client";
import {
  productPassports,
  productPassportVersions,
  brandTheme,
  brands,
} from "../../schema";
import type { DppSnapshot } from "../products/dpp-versions";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Theme configuration structure (brand-level).
 */
export interface ThemeConfig {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  [key: string]: unknown;
}

/**
 * Theme styles structure (brand-level).
 */
export interface ThemeStyles {
  [key: string]: unknown;
}

/**
 * Result of fetching a public DPP by UPID.
 */
export interface PublicDppResult {
  /** Whether the passport was found */
  found: boolean;
  /** Whether the working variant has been deleted (passport is inactive) */
  isInactive: boolean;
  /** The passport's UPID */
  upid: string;
  /** The passport data */
  passport: {
    id: string;
    brandId: string;
    workingVariantId: string | null;
    firstPublishedAt: string;
  } | null;
  /** The current version's snapshot data */
  snapshot: DppSnapshot | null;
  /** Version metadata */
  version: {
    id: string;
    versionNumber: number;
    schemaVersion: string;
    publishedAt: string;
    contentHash: string;
  } | null;
  /** Brand theme configuration */
  theme: {
    brandSlug: string | null;
    config: ThemeConfig | null;
    styles: ThemeStyles | null;
    stylesheetPath: string | null;
    googleFontsUrl: string | null;
  } | null;
  /** Error message if fetch failed */
  error?: string;
}

// =============================================================================
// MAIN PUBLIC QUERY
// =============================================================================

/**
 * Fetch public DPP data by UPID.
 *
 * This is the primary function for the new URL structure: /{upid}
 *
 * It fetches:
 * 1. Passport record by UPID
 * 2. Current version's snapshot (complete JSON-LD)
 * 3. Brand theme data (for styling)
 *
 * @param db - Database instance (should be serviceDb to bypass RLS)
 * @param upid - The Universal Product Identifier from the URL
 * @returns Public DPP data with snapshot and theme
 */
export async function getPublicDppByUpid(
  db: Database,
  upid: string,
): Promise<PublicDppResult> {
  // Step 1: Fetch passport by UPID
  const [passport] = await db
    .select({
      id: productPassports.id,
      upid: productPassports.upid,
      brandId: productPassports.brandId,
      workingVariantId: productPassports.workingVariantId,
      currentVersionId: productPassports.currentVersionId,
      firstPublishedAt: productPassports.firstPublishedAt,
    })
    .from(productPassports)
    .where(eq(productPassports.upid, upid))
    .limit(1);

  if (!passport) {
    return {
      found: false,
      isInactive: false,
      upid,
      passport: null,
      snapshot: null,
      version: null,
      theme: null,
      error: "Passport not found",
    };
  }

  // Check if the passport has been published
  if (!passport.currentVersionId) {
    return {
      found: false,
      isInactive: false,
      upid,
      passport: {
        id: passport.id,
        brandId: passport.brandId,
        workingVariantId: passport.workingVariantId,
        firstPublishedAt: passport.firstPublishedAt,
      },
      snapshot: null,
      version: null,
      theme: null,
      error: "Passport has not been published yet",
    };
  }

  // Step 2: Fetch the current version's snapshot
  const [version] = await db
    .select({
      id: productPassportVersions.id,
      versionNumber: productPassportVersions.versionNumber,
      dataSnapshot: productPassportVersions.dataSnapshot,
      contentHash: productPassportVersions.contentHash,
      schemaVersion: productPassportVersions.schemaVersion,
      publishedAt: productPassportVersions.publishedAt,
    })
    .from(productPassportVersions)
    .where(eq(productPassportVersions.id, passport.currentVersionId))
    .limit(1);

  if (!version) {
    return {
      found: false,
      isInactive: false,
      upid,
      passport: {
        id: passport.id,
        brandId: passport.brandId,
        workingVariantId: passport.workingVariantId,
        firstPublishedAt: passport.firstPublishedAt,
      },
      snapshot: null,
      version: null,
      theme: null,
      error: "Version not found",
    };
  }

  // Step 3: Fetch brand theme data
  const theme = await fetchBrandTheme(db, passport.brandId);

  // Check if working variant has been deleted (passport is inactive)
  const isInactive = passport.workingVariantId === null;

  return {
    found: true,
    isInactive,
    upid,
    passport: {
      id: passport.id,
      brandId: passport.brandId,
      workingVariantId: passport.workingVariantId,
      firstPublishedAt: passport.firstPublishedAt,
    },
    snapshot: version.dataSnapshot as DppSnapshot,
    version: {
      id: version.id,
      versionNumber: version.versionNumber,
      schemaVersion: version.schemaVersion,
      publishedAt: version.publishedAt,
      contentHash: version.contentHash,
    },
    theme,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Fetch brand theme data for styling the public DPP.
 * Uses a single JOIN query for optimal performance.
 *
 * @param db - Database instance
 * @param brandId - The brand ID
 * @returns Theme configuration and styles
 */
async function fetchBrandTheme(db: Database, brandId: string) {
  const [result] = await db
    .select({
      slug: brands.slug,
      themeConfig: brandTheme.themeConfig,
      themeStyles: brandTheme.themeStyles,
      stylesheetPath: brandTheme.stylesheetPath,
      googleFontsUrl: brandTheme.googleFontsUrl,
    })
    .from(brands)
    .leftJoin(brandTheme, eq(brandTheme.brandId, brands.id))
    .where(eq(brands.id, brandId))
    .limit(1);

  if (!result) {
    return {
      brandSlug: null,
      config: null,
      styles: null,
      stylesheetPath: null,
      googleFontsUrl: null,
    };
  }

  return {
    brandSlug: result.slug,
    config: result.themeConfig as ThemeConfig | null,
    styles: result.themeStyles as ThemeStyles | null,
    stylesheetPath: result.stylesheetPath,
    googleFontsUrl: result.googleFontsUrl,
  };
}

/**
 * Get a specific version of a passport by version number.
 * Useful for viewing historical versions.
 *
 * @param db - Database instance
 * @param upid - The passport UPID
 * @param versionNumber - The version number to fetch
 * @returns The specified version's data
 */
export async function getPublicDppVersion(
  db: Database,
  upid: string,
  versionNumber: number,
): Promise<PublicDppResult> {
  // Fetch passport by UPID
  const [passport] = await db
    .select({
      id: productPassports.id,
      upid: productPassports.upid,
      brandId: productPassports.brandId,
      workingVariantId: productPassports.workingVariantId,
      firstPublishedAt: productPassports.firstPublishedAt,
    })
    .from(productPassports)
    .where(eq(productPassports.upid, upid))
    .limit(1);

  if (!passport) {
    return {
      found: false,
      isInactive: false,
      upid,
      passport: null,
      snapshot: null,
      version: null,
      theme: null,
      error: "Passport not found",
    };
  }

  // Fetch the specific version
  const [version] = await db
    .select({
      id: productPassportVersions.id,
      versionNumber: productPassportVersions.versionNumber,
      dataSnapshot: productPassportVersions.dataSnapshot,
      contentHash: productPassportVersions.contentHash,
      schemaVersion: productPassportVersions.schemaVersion,
      publishedAt: productPassportVersions.publishedAt,
    })
    .from(productPassportVersions)
    .where(eq(productPassportVersions.passportId, passport.id))
    .limit(1);

  if (!version) {
    return {
      found: false,
      isInactive: false,
      upid,
      passport: {
        id: passport.id,
        brandId: passport.brandId,
        workingVariantId: passport.workingVariantId,
        firstPublishedAt: passport.firstPublishedAt,
      },
      snapshot: null,
      version: null,
      theme: null,
      error: `Version ${versionNumber} not found`,
    };
  }

  // Fetch brand theme data
  const theme = await fetchBrandTheme(db, passport.brandId);
  const isInactive = passport.workingVariantId === null;

  return {
    found: true,
    isInactive,
    upid,
    passport: {
      id: passport.id,
      brandId: passport.brandId,
      workingVariantId: passport.workingVariantId,
      firstPublishedAt: passport.firstPublishedAt,
    },
    snapshot: version.dataSnapshot as DppSnapshot,
    version: {
      id: version.id,
      versionNumber: version.versionNumber,
      schemaVersion: version.schemaVersion,
      publishedAt: version.publishedAt,
      contentHash: version.contentHash,
    },
    theme,
  };
}

/**
 * Check if a passport exists and is published.
 * Lightweight function for validation without fetching full data.
 *
 * @param db - Database instance
 * @param upid - The passport UPID
 * @returns Boolean indicating if the passport exists and is published
 */
export async function isPassportPublished(
  db: Database,
  upid: string,
): Promise<boolean> {
  const [passport] = await db
    .select({
      currentVersionId: productPassports.currentVersionId,
    })
    .from(productPassports)
    .where(eq(productPassports.upid, upid))
    .limit(1);

  return passport?.currentVersionId != null;
}
