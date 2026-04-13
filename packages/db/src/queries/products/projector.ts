/**
 * Passport projector operations.
 *
 * Centralizes snapshot materialization behind a single module:
 * - projectSinglePassport() for on-demand public reads and explicit variant publish
 * - projectDirtyPassports() for inline product publish and background projection
 * - projectDirtyPassportsAllBrands() for scheduled projector jobs
 */

import { createHash } from "node:crypto";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { Database } from "../../client";
import {
  productPassportVersions,
  productPassports,
  productVariants,
  products,
} from "../../schema";
import {
  type DppSnapshot,
  createDppVersion,
  getLatestVersion,
  getVersionSnapshot,
} from "./dpp-versions";
import { batchClearDirtyFlags } from "./passports";
import {
  type PublishProductsSetBasedResult,
  publishProductsSetBased,
} from "./publish-batch";
import { generateDppSnapshot } from "./snapshot";

type PassportVersionRow = {
  id: string;
  versionNumber: number;
  dataSnapshot: unknown;
  compressedSnapshot: Buffer | null;
  contentHash: string;
  schemaVersion: string;
  publishedAt: string;
};

type PassportProjectionRow = {
  id: string;
  upid: string;
  barcode: string | null;
  currentVersionId: string | null;
  firstPublishedAt: string | null;
  dirty: boolean;
  workingVariantId: string;
  brandId: string;
};

type PassportProjectionStateRow = {
  id: string;
  currentVersionId: string | null;
  firstPublishedAt: string | null;
};

type DirtyPassportRow = {
  passportId: string;
  productId: string;
};

type ProjectedPassportIdentifierRow = {
  id: string;
  upid: string;
  barcode: string | null;
  currentVersionId: string | null;
  firstPublishedAt: string | null;
};

/**
 * Options controlling batch passport projection.
 */
export interface ProjectDirtyPassportsOptions {
  /** Limit projection to these published products instead of scanning dirty passports. */
  productIds?: string[];
  /** Override the variant chunk size used by the set-based projector. */
  variantChunkSize?: number;
  /** Override the version schema identifier written to new versions. */
  schemaVersion?: string;
}

/**
 * Result of projecting a single passport.
 */
export interface ProjectSinglePassportResult {
  found: boolean;
  versionCreated: boolean;
  dirtyCleared: boolean;
  passport: PassportProjectionRow | null;
  snapshot: DppSnapshot | null;
  version: {
    id: string;
    versionNumber: number;
    schemaVersion: string;
    publishedAt: string;
    contentHash: string;
  } | null;
  error?: string;
}

/**
 * Result of projecting a batch of dirty passports for one brand.
 */
export interface ProjectDirtyPassportsResult {
  brandId: string;
  totalProductsProjected: number;
  totalDirtyPassportsRequested: number;
  totalPassportsProjected: number;
  totalVariantsConsidered: number;
  totalVariantsSkippedNoUpid: number;
  passportsCreated: number;
  versionsCreated: number;
  versionsSkippedUnchanged: number;
  dirtyFlagsCleared: number;
  firstPublishedSet: number;
  upids: string[];
  barcodes: string[];
}

/**
 * Result of projecting dirty passports across all brands.
 */
export interface ProjectDirtyPassportsAllBrandsResult {
  brandsProcessed: number;
  totalProductsProjected: number;
  totalDirtyPassportsRequested: number;
  totalPassportsProjected: number;
  totalVariantsConsidered: number;
  totalVariantsSkippedNoUpid: number;
  passportsCreated: number;
  versionsCreated: number;
  versionsSkippedUnchanged: number;
  dirtyFlagsCleared: number;
  firstPublishedSet: number;
  brands: ProjectDirtyPassportsResult[];
}

/**
 * Recursively sort object keys for deterministic JSON hashing.
 */
function sortObjectKeys(value: unknown): unknown {
  // Return primitives directly.
  if (value === null || typeof value !== "object") {
    return value;
  }

  // Preserve array order while sorting nested objects.
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortObjectKeys((value as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Calculate the content-only hash used for version deduplication.
 */
function calculateContentOnlyHash(snapshot: DppSnapshot): string {
  // Ignore publish metadata so unchanged content does not create new versions.
  const contentOnly = {
    "@context": snapshot["@context"],
    "@type": snapshot["@type"],
    "@id": snapshot["@id"],
    productIdentifiers: snapshot.productIdentifiers,
    productAttributes: snapshot.productAttributes,
    environmental: snapshot.environmental,
    materials: snapshot.materials,
    supplyChain: snapshot.supplyChain,
  };

  const canonicalJson = JSON.stringify(sortObjectKeys(contentOnly));
  return createHash("sha256").update(canonicalJson, "utf8").digest("hex");
}

/**
 * Convert a version row into the public projector shape.
 */
function mapProjectedVersion(version: PassportVersionRow | null) {
  // Return null for passports that still have no materialized version.
  if (!version) {
    return null;
  }

  return {
    id: version.id,
    versionNumber: version.versionNumber,
    schemaVersion: version.schemaVersion,
    publishedAt: version.publishedAt,
    contentHash: version.contentHash,
  };
}

/**
 * Remove duplicates while preserving the first-seen order.
 */
function uniqueStrings(values: Array<string | null | undefined>): string[] {
  // Filter nullish and blank strings before deduping.
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim() ?? null)
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

/**
 * Reuse an already-materialized version and clear the dirty flag.
 */
async function reuseProjectedVersion(
  db: Database,
  passport: PassportProjectionRow,
  version: PassportVersionRow,
  snapshot: DppSnapshot,
): Promise<ProjectSinglePassportResult> {
  // Point the passport at the winner version and clear dirty after reused projection.
  await finalizeProjectedPassport(
    db,
    passport,
    version.id,
    !passport.firstPublishedAt ? version.publishedAt : undefined,
  );

  const refreshedPassport = await getPassportProjectionRow(db, passport.id);

  return {
    found: true,
    versionCreated: false,
    dirtyCleared: passport.dirty,
    passport: refreshedPassport,
    snapshot,
    version: mapProjectedVersion(version),
  };
}

/**
 * Fetch the current version row by ID.
 */
async function getVersionById(
  db: Database,
  versionId: string | null,
): Promise<PassportVersionRow | null> {
  // Skip the lookup when no version pointer is present.
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
 * Load the lightweight passport state used by the single-passport projector.
 */
async function getPassportProjectionRow(
  db: Database,
  passportId: string,
): Promise<PassportProjectionRow | null> {
  // Read only the columns needed to materialize or serve the passport.
  const [passport] = await db
    .select({
      id: productPassports.id,
      upid: productVariants.upid,
      barcode: productVariants.barcode,
      currentVersionId: productPassports.currentVersionId,
      firstPublishedAt: productPassports.firstPublishedAt,
      dirty: productPassports.dirty,
      workingVariantId: productPassports.workingVariantId,
      brandId: products.brandId,
    })
    .from(productPassports)
    .innerJoin(
      productVariants,
      eq(productVariants.id, productPassports.workingVariantId),
    )
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(productPassports.id, passportId))
    .limit(1);

  if (!passport?.upid) {
    return null;
  }

  return {
    ...passport,
    upid: passport.upid,
  };
}

/**
 * Persist the current-version pointer, dirty flag, and optional first-publish timestamp.
 */
async function finalizeProjectedPassport(
  db: Database,
  passport: PassportProjectionRow,
  versionId: string,
  firstPublishedAt?: string,
): Promise<void> {
  // Apply the projector state transition in a single update.
  const updatePayload: {
    currentVersionId: string;
    dirty: boolean;
    updatedAt: string;
    firstPublishedAt?: string;
  } = {
    currentVersionId: versionId,
    dirty: false,
    updatedAt: new Date().toISOString(),
  };

  if (!passport.firstPublishedAt && firstPublishedAt) {
    updatePayload.firstPublishedAt = firstPublishedAt;
  }

  await db
    .update(productPassports)
    .set(updatePayload)
    .where(eq(productPassports.id, passport.id));
}

/**
 * List the subset of requested products that are currently published.
 */
async function listPublishedProductIds(
  db: Database,
  brandId: string,
  productIds: string[],
): Promise<string[]> {
  // Normalize explicit product filters against the brand and publish state.
  if (productIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.brandId, brandId),
        inArray(products.id, productIds),
        eq(products.status, "published"),
      ),
    );

  return rows.map((row) => row.id);
}

/**
 * Load dirty passports for the selected published products.
 */
async function listDirtyPassportsForProducts(
  db: Database,
  brandId: string,
  productIds: string[],
): Promise<DirtyPassportRow[]> {
  // Only dirty active passports with a published working product need projection.
  if (productIds.length === 0) {
    return [];
  }

  return db
    .select({
      passportId: productPassports.id,
      productId: products.id,
    })
    .from(productPassports)
    .innerJoin(
      productVariants,
      eq(productVariants.id, productPassports.workingVariantId),
    )
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(
        eq(products.brandId, brandId),
        inArray(products.id, productIds),
        eq(products.status, "published"),
        eq(productPassports.dirty, true),
      ),
    );
}

/**
 * Load the pre-projection passport state for all published products being processed.
 */
async function listExistingPassportStatesForProducts(
  db: Database,
  brandId: string,
  productIds: string[],
): Promise<Map<string, PassportProjectionStateRow>> {
  // Capture the old current-version pointers so firstPublishedAt is only set once.
  if (productIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      id: productPassports.id,
      currentVersionId: productPassports.currentVersionId,
      firstPublishedAt: productPassports.firstPublishedAt,
    })
    .from(productPassports)
    .innerJoin(
      productVariants,
      eq(productVariants.id, productPassports.workingVariantId),
    )
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(eq(products.brandId, brandId), inArray(products.id, productIds)),
    );

  return new Map(rows.map((row) => [row.id, row]));
}

/**
 * Load all published passports and identifiers for the processed products after projection.
 */
async function listProjectedPassportsForProducts(
  db: Database,
  brandId: string,
  productIds: string[],
): Promise<ProjectedPassportIdentifierRow[]> {
  // Read the final passport state used for cache revalidation and result reporting.
  if (productIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      id: productPassports.id,
      upid: productVariants.upid,
      barcode: productVariants.barcode,
      currentVersionId: productPassports.currentVersionId,
      firstPublishedAt: productPassports.firstPublishedAt,
    })
    .from(productPassports)
    .innerJoin(
      productVariants,
      eq(productVariants.id, productPassports.workingVariantId),
    )
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(
        eq(products.brandId, brandId),
        inArray(products.id, productIds),
        eq(products.status, "published"),
        isNotNull(productPassports.currentVersionId),
      ),
    );

  return rows.filter(
    (row): row is ProjectedPassportIdentifierRow => row.upid !== null,
  );
}

/**
 * Set firstPublishedAt for passports that received their first version in this run.
 */
async function setFirstPublishedAtForProjectedPassports(
  db: Database,
  passportIds: string[],
): Promise<number> {
  // Skip the update when no passport crossed the unpublished -> published boundary.
  if (passportIds.length === 0) {
    return 0;
  }

  const now = new Date().toISOString();
  const updated = await db
    .update(productPassports)
    .set({
      firstPublishedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        inArray(productPassports.id, passportIds),
        isNull(productPassports.firstPublishedAt),
        isNotNull(productPassports.currentVersionId),
      ),
    )
    .returning({ id: productPassports.id });

  return updated.length;
}

/**
 * Materialize a single passport and return the fresh snapshot.
 */
export async function projectSinglePassport(
  db: Database,
  passportId: string,
): Promise<ProjectSinglePassportResult> {
  // Load the passport record first so the projector can decide how to proceed.
  const passport = await getPassportProjectionRow(db, passportId);

  if (!passport) {
    return {
      found: false,
      versionCreated: false,
      dirtyCleared: false,
      passport: null,
      snapshot: null,
      version: null,
      error: "Passport not found",
    };
  }

  const currentVersion = await getVersionById(db, passport.currentVersionId);

  const snapshot = await generateDppSnapshot(
    db,
    passport.workingVariantId,
    passport.upid,
  );

  if (!snapshot) {
    return {
      found: true,
      versionCreated: false,
      dirtyCleared: false,
      passport,
      snapshot: currentVersion ? getVersionSnapshot(currentVersion) : null,
      version: mapProjectedVersion(currentVersion),
      error: "Failed to generate snapshot",
    };
  }

  const latestVersion = await getLatestVersion(db, passport.id);
  if (latestVersion) {
    const existingSnapshot = getVersionSnapshot(latestVersion);
    if (
      existingSnapshot &&
      calculateContentOnlyHash(snapshot) ===
        calculateContentOnlyHash(existingSnapshot)
    ) {
      // Reuse the current version when the materialized content is unchanged.
      return reuseProjectedVersion(
        db,
        passport,
        latestVersion,
        existingSnapshot,
      );
    }
  }

  // Write a new immutable version when the snapshot content changed.
  const version = await createDppVersion(db, passport.id, snapshot, "1.0");
  if (!version) {
    const concurrentVersion = await getLatestVersion(db, passport.id);
    const concurrentSnapshot = concurrentVersion
      ? getVersionSnapshot(concurrentVersion)
      : null;

    if (
      concurrentVersion &&
      concurrentSnapshot &&
      calculateContentOnlyHash(snapshot) ===
        calculateContentOnlyHash(concurrentSnapshot)
    ) {
      // Another projector won the race with equivalent content, so reuse it.
      return reuseProjectedVersion(
        db,
        passport,
        concurrentVersion,
        concurrentSnapshot,
      );
    }

    return {
      found: true,
      versionCreated: false,
      dirtyCleared: false,
      passport,
      snapshot:
        concurrentSnapshot ??
        (currentVersion ? getVersionSnapshot(currentVersion) : null),
      version: mapProjectedVersion(
        (concurrentVersion as PassportVersionRow | null) ?? currentVersion,
      ),
      error: "Failed to create version record",
    };
  }

  await finalizeProjectedPassport(
    db,
    passport,
    version.id,
    !passport.currentVersionId ? version.publishedAt : undefined,
  );

  const refreshedPassport = await getPassportProjectionRow(db, passport.id);
  return {
    found: true,
    versionCreated: true,
    dirtyCleared: true,
    passport: refreshedPassport,
    snapshot: getVersionSnapshot(version),
    version: mapProjectedVersion(version),
  };
}

/**
 * Project dirty passports for one brand, optionally forcing a published product subset.
 */
export async function projectDirtyPassports(
  db: Database,
  brandId: string,
  options: ProjectDirtyPassportsOptions = {},
): Promise<ProjectDirtyPassportsResult> {
  // Normalize the explicit product filter first so empty inputs short-circuit early.
  const requestedProductIds = Array.from(new Set(options.productIds ?? []));
  const hasExplicitProductFilter = requestedProductIds.length > 0;
  const explicitPublishedProductIds = hasExplicitProductFilter
    ? await listPublishedProductIds(db, brandId, requestedProductIds)
    : [];

  if (hasExplicitProductFilter && explicitPublishedProductIds.length === 0) {
    return {
      brandId,
      totalProductsProjected: 0,
      totalDirtyPassportsRequested: 0,
      totalPassportsProjected: 0,
      totalVariantsConsidered: 0,
      totalVariantsSkippedNoUpid: 0,
      passportsCreated: 0,
      versionsCreated: 0,
      versionsSkippedUnchanged: 0,
      dirtyFlagsCleared: 0,
      firstPublishedSet: 0,
      upids: [],
      barcodes: [],
    };
  }

  const dirtyPassports = hasExplicitProductFilter
    ? await listDirtyPassportsForProducts(
        db,
        brandId,
        explicitPublishedProductIds,
      )
    : await db
        .select({
          passportId: productPassports.id,
          productId: products.id,
        })
        .from(productPassports)
        .innerJoin(
          productVariants,
          eq(productVariants.id, productPassports.workingVariantId),
        )
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(
          and(
            eq(products.brandId, brandId),
            eq(products.status, "published"),
            eq(productPassports.dirty, true),
          ),
        );

  const publishedProductIds = hasExplicitProductFilter
    ? explicitPublishedProductIds
    : Array.from(new Set(dirtyPassports.map((row) => row.productId)));

  if (publishedProductIds.length === 0) {
    return {
      brandId,
      totalProductsProjected: 0,
      totalDirtyPassportsRequested: dirtyPassports.length,
      totalPassportsProjected: 0,
      totalVariantsConsidered: 0,
      totalVariantsSkippedNoUpid: 0,
      passportsCreated: 0,
      versionsCreated: 0,
      versionsSkippedUnchanged: 0,
      dirtyFlagsCleared: 0,
      firstPublishedSet: 0,
      upids: [],
      barcodes: [],
    };
  }

  const preProjectionState = await listExistingPassportStatesForProducts(
    db,
    brandId,
    publishedProductIds,
  );

  const batchResult: PublishProductsSetBasedResult =
    await publishProductsSetBased(db, {
      brandId,
      productIds: publishedProductIds,
      variantChunkSize: options.variantChunkSize,
      schemaVersion: options.schemaVersion,
    });

  const projectedPassports = await listProjectedPassportsForProducts(
    db,
    brandId,
    publishedProductIds,
  );

  const firstPublishedPassportIds = projectedPassports
    .filter((passport) => {
      const previous = preProjectionState.get(passport.id);
      return (
        passport.currentVersionId !== null &&
        passport.firstPublishedAt === null &&
        (previous?.currentVersionId ?? null) === null
      );
    })
    .map((passport) => passport.id);

  const [firstPublishedSet, dirtyClearResult] = await Promise.all([
    setFirstPublishedAtForProjectedPassports(db, firstPublishedPassportIds),
    batchClearDirtyFlags(
      db,
      dirtyPassports.map((row) => row.passportId),
    ),
  ]);

  return {
    brandId,
    totalProductsProjected: publishedProductIds.length,
    totalDirtyPassportsRequested: dirtyPassports.length,
    totalPassportsProjected: projectedPassports.length,
    totalVariantsConsidered: batchResult.totalVariantsConsidered,
    totalVariantsSkippedNoUpid: batchResult.totalVariantsSkippedNoUpid,
    passportsCreated: batchResult.passportsCreated,
    versionsCreated: batchResult.versionsCreated,
    versionsSkippedUnchanged: batchResult.versionsSkippedUnchanged,
    dirtyFlagsCleared: dirtyClearResult.cleared,
    firstPublishedSet,
    upids: uniqueStrings(projectedPassports.map((passport) => passport.upid)),
    barcodes: uniqueStrings(
      projectedPassports.map((passport) => passport.barcode),
    ),
  };
}

/**
 * Project dirty passports across every brand that currently has pending work.
 */
export async function projectDirtyPassportsAllBrands(
  db: Database,
  options: Omit<ProjectDirtyPassportsOptions, "productIds"> = {},
): Promise<ProjectDirtyPassportsAllBrandsResult> {
  // Scan the dirty-passport index and process brands one at a time.
  const brandRows = await db
    .select({ brandId: products.brandId })
    .from(productPassports)
    .innerJoin(
      productVariants,
      eq(productVariants.id, productPassports.workingVariantId),
    )
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(eq(productPassports.dirty, true), isNotNull(products.brandId)),
    )
    .groupBy(products.brandId);

  const results: ProjectDirtyPassportsResult[] = [];

  for (const row of brandRows) {
    if (!row.brandId) {
      continue;
    }

    results.push(
      await projectDirtyPassports(db, row.brandId, {
        variantChunkSize: options.variantChunkSize,
        schemaVersion: options.schemaVersion,
      }),
    );
  }

  return {
    brandsProcessed: results.length,
    totalProductsProjected: results.reduce(
      (sum, result) => sum + result.totalProductsProjected,
      0,
    ),
    totalDirtyPassportsRequested: results.reduce(
      (sum, result) => sum + result.totalDirtyPassportsRequested,
      0,
    ),
    totalPassportsProjected: results.reduce(
      (sum, result) => sum + result.totalPassportsProjected,
      0,
    ),
    totalVariantsConsidered: results.reduce(
      (sum, result) => sum + result.totalVariantsConsidered,
      0,
    ),
    totalVariantsSkippedNoUpid: results.reduce(
      (sum, result) => sum + result.totalVariantsSkippedNoUpid,
      0,
    ),
    passportsCreated: results.reduce(
      (sum, result) => sum + result.passportsCreated,
      0,
    ),
    versionsCreated: results.reduce(
      (sum, result) => sum + result.versionsCreated,
      0,
    ),
    versionsSkippedUnchanged: results.reduce(
      (sum, result) => sum + result.versionsSkippedUnchanged,
      0,
    ),
    dirtyFlagsCleared: results.reduce(
      (sum, result) => sum + result.dirtyFlagsCleared,
      0,
    ),
    firstPublishedSet: results.reduce(
      (sum, result) => sum + result.firstPublishedSet,
      0,
    ),
    brands: results,
  };
}
