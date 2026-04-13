/**
 * Public DPP lookup helpers.
 *
 * Public passport resolution now flows through live variants. If the variant,
 * product, or passport is deleted, the public lookup immediately disappears.
 */

import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../../client";
import {
  brandTheme,
  brands,
  productPassportVersions,
  productPassports,
  productVariants,
  products,
} from "../../schema";
import { type DppSnapshot, getVersionSnapshot } from "../products/dpp-versions";

/**
 * Brand passport structure (brand-level theme/layout).
 */
export interface BrandPassport {
  [key: string]: unknown;
}

/**
 * Result of fetching a public DPP by UPID.
 */
export interface PublicDppResult {
  /** Whether the passport was found */
  found: boolean;
  /** Retained for response-shape stability; always false after orphan removal. */
  isInactive: boolean;
  /** The variant's UPID */
  upid: string;
  /** The passport data */
  passport: {
    id: string;
    brandId: string | null;
    workingVariantId: string | null;
    firstPublishedAt: string | null;
    dirty: boolean;
  } | null;
  /** Working product publication state */
  productStatus: "published" | "unpublished" | "scheduled" | null;
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
    passport: BrandPassport | null;
  } | null;
  /** Error message if fetch failed */
  error?: string;
}

/**
 * Shared live passport row returned by variant-rooted lookups.
 */
interface LivePublicPassportRow {
  id: string;
  upid: string;
  barcode: string | null;
  brandId: string;
  workingVariantId: string;
  currentVersionId: string | null;
  firstPublishedAt: string | null;
  dirty: boolean;
  productStatus: "published" | "unpublished" | "scheduled";
}

/**
 * Load the live passport row for a public UPID.
 */
async function getLivePassportByUpid(
  db: Database,
  upid: string,
): Promise<LivePublicPassportRow | null> {
  // Resolve public identity from the live variant and its linked passport.
  const [passport] = await db
    .select({
      id: productPassports.id,
      upid: productVariants.upid,
      barcode: productVariants.barcode,
      brandId: products.brandId,
      workingVariantId: productVariants.id,
      currentVersionId: productPassports.currentVersionId,
      firstPublishedAt: productPassports.firstPublishedAt,
      dirty: productPassports.dirty,
      productStatus: products.status,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(
      productPassports,
      eq(productPassports.workingVariantId, productVariants.id),
    )
    .where(eq(productVariants.upid, upid))
    .limit(1);

  if (!passport?.upid) {
    return null;
  }

  return {
    ...passport,
    upid: passport.upid,
    productStatus: passport.productStatus as
      | "published"
      | "unpublished"
      | "scheduled",
  };
}

/**
 * Load the live passport row for a brand-scoped barcode.
 */
export async function getPublicPassportByBarcode(
  db: Database,
  brandId: string,
  barcode: string,
): Promise<LivePublicPassportRow | null> {
  // Match either the supplied barcode or its normalized GTIN-14 representation.
  const normalizedBarcode = barcode.padStart(14, "0");
  const barcodes =
    normalizedBarcode === barcode ? [barcode] : [barcode, normalizedBarcode];

  const [passport] = await db
    .select({
      id: productPassports.id,
      upid: productVariants.upid,
      barcode: productVariants.barcode,
      brandId: products.brandId,
      workingVariantId: productVariants.id,
      currentVersionId: productPassports.currentVersionId,
      firstPublishedAt: productPassports.firstPublishedAt,
      dirty: productPassports.dirty,
      productStatus: products.status,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(
      productPassports,
      eq(productPassports.workingVariantId, productVariants.id),
    )
    .where(
      and(
        eq(products.brandId, brandId),
        inArray(productVariants.barcode, barcodes),
      ),
    )
    .limit(1);

  if (!passport?.upid) {
    return null;
  }

  return {
    ...passport,
    upid: passport.upid,
    productStatus: passport.productStatus as
      | "published"
      | "unpublished"
      | "scheduled",
  };
}

/**
 * Fetch brand theme data for styling the public DPP.
 */
async function fetchBrandTheme(db: Database, brandId: string) {
  // Resolve the owning brand's theme and slug in one joined read.
  const [result] = await db
    .select({
      slug: brands.slug,
      passport: brandTheme.passport,
    })
    .from(brands)
    .leftJoin(brandTheme, eq(brandTheme.brandId, brands.id))
    .where(eq(brands.id, brandId))
    .limit(1);

  if (!result) {
    return {
      brandSlug: null,
      passport: null,
    };
  }

  return {
    brandSlug: result.slug,
    passport: result.passport as BrandPassport | null,
  };
}

/**
 * Load a specific version row by ID.
 */
async function getVersionById(
  db: Database,
  versionId: string | null,
): Promise<{
  id: string;
  versionNumber: number;
  dataSnapshot: unknown;
  compressedSnapshot: Buffer | null;
  contentHash: string;
  schemaVersion: string;
  publishedAt: string;
} | null> {
  // Skip the lookup when the passport has not been materialized yet.
  if (!versionId) {
    return null;
  }

  const [version] = await db
    .select({
      id: productPassportVersions.id,
      versionNumber: productPassportVersions.versionNumber,
      dataSnapshot: productPassportVersions.dataSnapshot,
      compressedSnapshot: productPassportVersions.compressedSnapshot,
      contentHash: productPassportVersions.contentHash,
      schemaVersion: productPassportVersions.schemaVersion,
      publishedAt: productPassportVersions.publishedAt,
    })
    .from(productPassportVersions)
    .where(eq(productPassportVersions.id, versionId))
    .limit(1);

  return version ?? null;
}

/**
 * Map a live passport row and version into the public response shape.
 */
async function buildPublicResult(
  db: Database,
  passport: LivePublicPassportRow | null,
): Promise<PublicDppResult> {
  // Translate the live joined row into the stable public contract.
  if (!passport) {
    return {
      found: false,
      isInactive: false,
      upid: "",
      passport: null,
      productStatus: null,
      snapshot: null,
      version: null,
      theme: null,
      error: "Passport not found",
    };
  }

  const [version, theme] = await Promise.all([
    getVersionById(db, passport.currentVersionId),
    fetchBrandTheme(db, passport.brandId),
  ]);
  const snapshot = version
    ? getVersionSnapshot({
        dataSnapshot: version.dataSnapshot as DppSnapshot | null,
        compressedSnapshot: version.compressedSnapshot,
      })
    : null;

  return {
    found: true,
    isInactive: false,
    upid: passport.upid,
    passport: {
      id: passport.id,
      brandId: passport.brandId,
      workingVariantId: passport.workingVariantId,
      firstPublishedAt: passport.firstPublishedAt,
      dirty: passport.dirty,
    },
    productStatus: passport.productStatus,
    snapshot,
    version: version
      ? {
          id: version.id,
          versionNumber: version.versionNumber,
          schemaVersion: version.schemaVersion,
          publishedAt: version.publishedAt,
          contentHash: version.contentHash,
        }
      : null,
    theme,
    error: version ? undefined : "Passport has not been materialized yet",
  };
}

/**
 * Fetch public DPP data by UPID.
 */
export async function getPublicDppByUpid(
  db: Database,
  upid: string,
): Promise<PublicDppResult> {
  // Resolve through the live variant so deleted variants immediately 404.
  const passport = await getLivePassportByUpid(db, upid);

  if (!passport) {
    return {
      found: false,
      isInactive: false,
      upid,
      passport: null,
      productStatus: null,
      snapshot: null,
      version: null,
      theme: null,
      error: "Passport not found",
    };
  }

  const result = await buildPublicResult(db, passport);
  return {
    ...result,
    upid,
  };
}

/**
 * Get a specific historical version for a live passport.
 */
export async function getPublicDppVersion(
  db: Database,
  upid: string,
  versionNumber: number,
): Promise<PublicDppResult> {
  // Historical lookups are only valid while the live variant and passport exist.
  const passport = await getLivePassportByUpid(db, upid);

  if (!passport) {
    return {
      found: false,
      isInactive: false,
      upid,
      passport: null,
      productStatus: null,
      snapshot: null,
      version: null,
      theme: null,
      error: "Passport not found",
    };
  }

  const [version, theme] = await Promise.all([
    db
      .select({
        id: productPassportVersions.id,
        versionNumber: productPassportVersions.versionNumber,
        dataSnapshot: productPassportVersions.dataSnapshot,
        compressedSnapshot: productPassportVersions.compressedSnapshot,
        contentHash: productPassportVersions.contentHash,
        schemaVersion: productPassportVersions.schemaVersion,
        publishedAt: productPassportVersions.publishedAt,
      })
      .from(productPassportVersions)
      .where(
        and(
          eq(productPassportVersions.passportId, passport.id),
          eq(productPassportVersions.versionNumber, versionNumber),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
    fetchBrandTheme(db, passport.brandId),
  ]);

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
        dirty: passport.dirty,
      },
      productStatus: passport.productStatus,
      snapshot: null,
      version: null,
      theme,
      error: `Version ${versionNumber} not found`,
    };
  }

  return {
    found: true,
    isInactive: false,
    upid,
    passport: {
      id: passport.id,
      brandId: passport.brandId,
      workingVariantId: passport.workingVariantId,
      firstPublishedAt: passport.firstPublishedAt,
      dirty: passport.dirty,
    },
    productStatus: passport.productStatus,
    snapshot: getVersionSnapshot({
      dataSnapshot: version.dataSnapshot as DppSnapshot | null,
      compressedSnapshot: version.compressedSnapshot,
    }),
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
 * Check whether a live passport exists and is publicly published.
 */
export async function isPassportPublished(
  db: Database,
  upid: string,
): Promise<boolean> {
  // Public visibility requires a live passport, a materialized version, and a published product.
  const passport = await getLivePassportByUpid(db, upid);
  return Boolean(
    passport &&
      passport.currentVersionId &&
      passport.productStatus === "published",
  );
}
