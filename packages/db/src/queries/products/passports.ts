/**
 * Product Passport CRUD operations.
 *
 * Manages product_passports records in the publishing layer.
 * These records persist independently of the working layer to ensure
 * QR codes remain resolvable indefinitely.
 */

import { eq, inArray } from "drizzle-orm";
import type { Database, DatabaseOrTransaction } from "../../client";
import {
  productPassportVersions,
  productPassports,
  productVariants,
} from "../../schema";

// =============================================================================
// CREATE OPERATIONS
// =============================================================================

/**
 * Create a new product passport for a variant.
 *
 * The passport uses the variant's existing UPID to ensure URL consistency.
 * The variant MUST have a UPID assigned before publishing.
 *
 * @param db - Database instance
 * @param variantId - The variant ID to link this passport to
 * @param brandId - The brand ID that owns this passport
 * @returns The created passport record
 * @throws Error if the variant doesn't have a UPID
 */
export async function createProductPassport(
  db: Database,
  variantId: string,
  brandId: string,
) {
  // Get the variant's data - UPID must exist, also get sku/barcode
  const [variant] = await db
    .select({
      upid: productVariants.upid,
      sku: productVariants.sku,
      barcode: productVariants.barcode,
    })
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1);

  if (!variant) {
    throw new Error(`Variant not found: ${variantId}`);
  }

  if (!variant.upid) {
    throw new Error(
      `Cannot create passport for variant ${variantId}: variant has no UPID assigned. Variants must have a UPID before they can have a passport.`,
    );
  }

  const now = new Date().toISOString();
  const [passport] = await db
    .insert(productPassports)
    .values({
      upid: variant.upid,
      brandId,
      workingVariantId: variantId,
      status: "active",
      sku: variant.sku,
      barcode: variant.barcode,
      firstPublishedAt: now,
    })
    .returning({
      id: productPassports.id,
      upid: productPassports.upid,
      brandId: productPassports.brandId,
      workingVariantId: productPassports.workingVariantId,
      currentVersionId: productPassports.currentVersionId,
      status: productPassports.status,
      orphanedAt: productPassports.orphanedAt,
      sku: productPassports.sku,
      barcode: productPassports.barcode,
      firstPublishedAt: productPassports.firstPublishedAt,
      createdAt: productPassports.createdAt,
      updatedAt: productPassports.updatedAt,
    });

  return passport;
}

// =============================================================================
// READ OPERATIONS
// =============================================================================

/**
 * Get a passport by its UPID.
 *
 * @param db - Database instance
 * @param upid - The Universal Product Identifier
 * @returns The passport with current version data, or null if not found
 */
export async function getPassportByUpid(db: Database, upid: string) {
  const [passport] = await db
    .select({
      id: productPassports.id,
      upid: productPassports.upid,
      brandId: productPassports.brandId,
      workingVariantId: productPassports.workingVariantId,
      currentVersionId: productPassports.currentVersionId,
      status: productPassports.status,
      orphanedAt: productPassports.orphanedAt,
      sku: productPassports.sku,
      barcode: productPassports.barcode,
      firstPublishedAt: productPassports.firstPublishedAt,
      createdAt: productPassports.createdAt,
      updatedAt: productPassports.updatedAt,
    })
    .from(productPassports)
    .where(eq(productPassports.upid, upid))
    .limit(1);

  if (!passport) {
    return null;
  }

  // If there's a current version, fetch its data
  let currentVersion = null;
  if (passport.currentVersionId) {
    const [version] = await db
      .select({
        id: productPassportVersions.id,
        passportId: productPassportVersions.passportId,
        versionNumber: productPassportVersions.versionNumber,
        dataSnapshot: productPassportVersions.dataSnapshot,
        contentHash: productPassportVersions.contentHash,
        schemaVersion: productPassportVersions.schemaVersion,
        publishedAt: productPassportVersions.publishedAt,
      })
      .from(productPassportVersions)
      .where(eq(productPassportVersions.id, passport.currentVersionId))
      .limit(1);

    currentVersion = version ?? null;
  }

  return {
    ...passport,
    currentVersion,
  };
}

/**
 * Get a passport by its working variant ID.
 * Used to check if a variant already has a passport before creating a new one.
 *
 * @param db - Database instance
 * @param variantId - The variant ID to look up
 * @returns The passport if found, or null
 */
export async function getPassportByVariantId(db: Database, variantId: string) {
  const [passport] = await db
    .select({
      id: productPassports.id,
      upid: productPassports.upid,
      brandId: productPassports.brandId,
      workingVariantId: productPassports.workingVariantId,
      currentVersionId: productPassports.currentVersionId,
      status: productPassports.status,
      orphanedAt: productPassports.orphanedAt,
      sku: productPassports.sku,
      barcode: productPassports.barcode,
      firstPublishedAt: productPassports.firstPublishedAt,
      createdAt: productPassports.createdAt,
      updatedAt: productPassports.updatedAt,
    })
    .from(productPassports)
    .where(eq(productPassports.workingVariantId, variantId))
    .limit(1);

  return passport ?? null;
}

/**
 * Get all passports for a product's variants.
 *
 * @param db - Database instance
 * @param productId - The product ID
 * @returns Array of passports for all variants of the product
 */
export async function getPassportsForProduct(db: Database, productId: string) {
  // First, get all variant IDs for this product
  const variants = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(eq(productVariants.productId, productId));

  if (variants.length === 0) {
    return [];
  }

  const variantIds = variants.map((v) => v.id);

  // Get all passports for these variants
  const passports = await db
    .select({
      id: productPassports.id,
      upid: productPassports.upid,
      brandId: productPassports.brandId,
      workingVariantId: productPassports.workingVariantId,
      currentVersionId: productPassports.currentVersionId,
      status: productPassports.status,
      orphanedAt: productPassports.orphanedAt,
      sku: productPassports.sku,
      barcode: productPassports.barcode,
      firstPublishedAt: productPassports.firstPublishedAt,
      createdAt: productPassports.createdAt,
      updatedAt: productPassports.updatedAt,
    })
    .from(productPassports)
    .where(inArray(productPassports.workingVariantId, variantIds));

  return passports;
}

// =============================================================================
// UPDATE OPERATIONS
// =============================================================================

/**
 * Update a passport's current version after publishing.
 *
 * @param db - Database instance
 * @param passportId - The passport ID to update
 * @param versionId - The new current version ID
 * @returns The updated passport, or null if not found
 */
export async function updatePassportCurrentVersion(
  db: Database,
  passportId: string,
  versionId: string,
) {
  const now = new Date().toISOString();

  const [updated] = await db
    .update(productPassports)
    .set({
      currentVersionId: versionId,
      updatedAt: now,
    })
    .where(eq(productPassports.id, passportId))
    .returning({
      id: productPassports.id,
      upid: productPassports.upid,
      brandId: productPassports.brandId,
      workingVariantId: productPassports.workingVariantId,
      currentVersionId: productPassports.currentVersionId,
      status: productPassports.status,
      orphanedAt: productPassports.orphanedAt,
      sku: productPassports.sku,
      barcode: productPassports.barcode,
      firstPublishedAt: productPassports.firstPublishedAt,
      createdAt: productPassports.createdAt,
      updatedAt: productPassports.updatedAt,
    });

  return updated ?? null;
}

/**
 * Sync passport SKU and barcode fields when variant data is updated.
 *
 * This keeps the passport's identifier fields in sync with the working variant.
 * Only updates fields that are explicitly provided (undefined = no change, null = clear).
 *
 * @param db - Database instance
 * @param variantId - The variant ID whose passport should be updated
 * @param updates - Object with optional sku and barcode fields to update
 * @returns The updated passport, or null if no passport exists for this variant
 */
export async function syncPassportMetadata(
  db: DatabaseOrTransaction,
  variantId: string,
  updates: {
    sku?: string | null;
    barcode?: string | null;
  },
) {
  // Only proceed if there are fields to update
  const hasSkuUpdate = updates.sku !== undefined;
  const hasBarcodeUpdate = updates.barcode !== undefined;

  if (!hasSkuUpdate && !hasBarcodeUpdate) {
    return null;
  }

  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    updatedAt: now,
  };

  if (hasSkuUpdate) {
    updatePayload.sku = updates.sku;
  }

  if (hasBarcodeUpdate) {
    updatePayload.barcode = updates.barcode;
  }

  const [updated] = await db
    .update(productPassports)
    .set(updatePayload)
    .where(eq(productPassports.workingVariantId, variantId))
    .returning({
      id: productPassports.id,
      upid: productPassports.upid,
      brandId: productPassports.brandId,
      workingVariantId: productPassports.workingVariantId,
      currentVersionId: productPassports.currentVersionId,
      status: productPassports.status,
      orphanedAt: productPassports.orphanedAt,
      sku: productPassports.sku,
      barcode: productPassports.barcode,
      firstPublishedAt: productPassports.firstPublishedAt,
      createdAt: productPassports.createdAt,
      updatedAt: productPassports.updatedAt,
    });

  return updated ?? null;
}

/**
 * Batch sync passport SKU and barcode fields for multiple variants.
 *
 * Used during bulk operations where multiple variants' metadata changes.
 * Updates all passports that have a workingVariantId in the provided map.
 *
 * @param db - Database instance
 * @param updates - Map of variantId -> { sku?, barcode? }
 * @returns Count of updated passports
 */
export async function batchSyncPassportMetadata(
  db: DatabaseOrTransaction,
  updates: Map<string, { sku?: string | null; barcode?: string | null }>,
) {
  if (updates.size === 0) {
    return { updated: 0 };
  }

  let updatedCount = 0;

  // Process updates one by one (could be optimized with CASE statements for large batches)
  for (const [variantId, metadata] of updates) {
    const hasSkuUpdate = metadata.sku !== undefined;
    const hasBarcodeUpdate = metadata.barcode !== undefined;

    if (!hasSkuUpdate && !hasBarcodeUpdate) {
      continue;
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      updatedAt: now,
    };

    if (hasSkuUpdate) {
      updatePayload.sku = metadata.sku;
    }

    if (hasBarcodeUpdate) {
      updatePayload.barcode = metadata.barcode;
    }

    const result = await db
      .update(productPassports)
      .set(updatePayload)
      .where(eq(productPassports.workingVariantId, variantId))
      .returning({ id: productPassports.id });

    updatedCount += result.length;
  }

  return { updated: updatedCount };
}

/**
 * Check if a passport exists for a variant, or create one if it doesn't.
 * This is the main entry point for the publish flow.
 *
 * @param db - Database instance
 * @param variantId - The variant ID
 * @param brandId - The brand ID
 * @returns The existing or newly created passport
 */
export async function getOrCreatePassport(
  db: Database,
  variantId: string,
  brandId: string,
) {
  // First, check if a passport already exists
  const existing = await getPassportByVariantId(db, variantId);
  if (existing) {
    return { passport: existing, isNew: false };
  }

  // Create a new passport
  const passport = await createProductPassport(db, variantId, brandId);
  return { passport, isNew: true };
}

// =============================================================================
// ORPHAN OPERATIONS
// =============================================================================

/**
 * Orphan a passport when its working variant is deleted.
 *
 * This preserves the passport record and version history but severs the
 * connection to the working layer. The passport's sku and barcode are cleared
 * to prevent identifier conflicts.
 *
 * @param db - Database instance
 * @param passportId - The passport ID to orphan
 * @returns The updated passport, or null if not found
 */
export async function orphanPassport(db: Database, passportId: string) {
  const now = new Date().toISOString();

  const [updated] = await db
    .update(productPassports)
    .set({
      status: "orphaned",
      workingVariantId: null,
      sku: null,
      barcode: null,
      orphanedAt: now,
      updatedAt: now,
    })
    .where(eq(productPassports.id, passportId))
    .returning({
      id: productPassports.id,
      upid: productPassports.upid,
      brandId: productPassports.brandId,
      workingVariantId: productPassports.workingVariantId,
      currentVersionId: productPassports.currentVersionId,
      status: productPassports.status,
      orphanedAt: productPassports.orphanedAt,
      sku: productPassports.sku,
      barcode: productPassports.barcode,
      firstPublishedAt: productPassports.firstPublishedAt,
      createdAt: productPassports.createdAt,
      updatedAt: productPassports.updatedAt,
    });

  return updated ?? null;
}

/**
 * Batch orphan passports by their working variant IDs.
 *
 * Used when multiple variants are being deleted at once (e.g., during sync or bulk delete).
 * Passports whose workingVariantId matches any of the given IDs will be orphaned.
 *
 * @param db - Database instance
 * @param variantIds - Array of variant IDs whose passports should be orphaned
 * @returns Object with count of orphaned passports
 */
export async function batchOrphanPassportsByVariantIds(
  db: DatabaseOrTransaction,
  variantIds: string[],
) {
  if (variantIds.length === 0) {
    return { orphaned: 0 };
  }

  const now = new Date().toISOString();

  const result = await db
    .update(productPassports)
    .set({
      status: "orphaned",
      workingVariantId: null,
      sku: null,
      barcode: null,
      orphanedAt: now,
      updatedAt: now,
    })
    .where(inArray(productPassports.workingVariantId, variantIds))
    .returning({ id: productPassports.id });

  return { orphaned: result.length };
}

/**
 * Create a passport for a newly created variant.
 *
 * This is called immediately after variant creation to ensure a passport
 * record exists. Unlike getOrCreatePassport (which is used during publish),
 * this function assumes the variant was just created and has a UPID.
 *
 * @param db - Database instance
 * @param variantId - The newly created variant's ID
 * @param brandId - The brand ID
 * @param variantData - Data to copy to the passport (upid, sku, barcode)
 * @returns The created passport
 */
export async function createPassportForVariant(
  db: DatabaseOrTransaction,
  variantId: string,
  brandId: string,
  variantData: {
    upid: string;
    sku?: string | null;
    barcode?: string | null;
  },
) {
  const now = new Date().toISOString();

  const [passport] = await db
    .insert(productPassports)
    .values({
      upid: variantData.upid,
      brandId,
      workingVariantId: variantId,
      status: "active",
      sku: variantData.sku ?? null,
      barcode: variantData.barcode ?? null,
      firstPublishedAt: now,
    })
    .returning({
      id: productPassports.id,
      upid: productPassports.upid,
      brandId: productPassports.brandId,
      workingVariantId: productPassports.workingVariantId,
      currentVersionId: productPassports.currentVersionId,
      status: productPassports.status,
      orphanedAt: productPassports.orphanedAt,
      sku: productPassports.sku,
      barcode: productPassports.barcode,
      firstPublishedAt: productPassports.firstPublishedAt,
      createdAt: productPassports.createdAt,
      updatedAt: productPassports.updatedAt,
    });

  return passport;
}

/**
 * Batch create passports for multiple newly created variants.
 *
 * Used during bulk variant creation (e.g., sync, bulk import).
 *
 * @param db - Database instance
 * @param brandId - The brand ID
 * @param variants - Array of variant data to create passports for
 * @returns Array of created passports
 */
export async function batchCreatePassportsForVariants(
  db: Database,
  brandId: string,
  variants: Array<{
    variantId: string;
    upid: string;
    sku?: string | null;
    barcode?: string | null;
  }>,
) {
  if (variants.length === 0) {
    return [];
  }

  const now = new Date().toISOString();

  const passports = await db
    .insert(productPassports)
    .values(
      variants.map((v) => ({
        upid: v.upid,
        brandId,
        workingVariantId: v.variantId,
        status: "active",
        sku: v.sku ?? null,
        barcode: v.barcode ?? null,
        firstPublishedAt: now,
      })),
    )
    .returning({
      id: productPassports.id,
      upid: productPassports.upid,
      brandId: productPassports.brandId,
      workingVariantId: productPassports.workingVariantId,
      currentVersionId: productPassports.currentVersionId,
      status: productPassports.status,
      orphanedAt: productPassports.orphanedAt,
      sku: productPassports.sku,
      barcode: productPassports.barcode,
      firstPublishedAt: productPassports.firstPublishedAt,
      createdAt: productPassports.createdAt,
      updatedAt: productPassports.updatedAt,
    });

  return passports;
}
