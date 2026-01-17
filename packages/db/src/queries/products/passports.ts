/**
 * Product Passport CRUD operations.
 *
 * Manages product_passports records in the publishing layer.
 * These records persist independently of the working layer to ensure
 * QR codes remain resolvable indefinitely.
 */

import { eq } from "drizzle-orm";
import type { Database } from "../../client";
import {
  productPassports,
  productPassportVersions,
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
  // Get the variant's UPID - it must exist
  const [variant] = await db
    .select({ upid: productVariants.upid })
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1);

  if (!variant) {
    throw new Error(`Variant not found: ${variantId}`);
  }

  if (!variant.upid) {
    throw new Error(
      `Cannot publish variant ${variantId}: variant has no UPID assigned. ` +
        `Variants must have a UPID before they can be published.`,
    );
  }

  const now = new Date().toISOString();
  const [passport] = await db
    .insert(productPassports)
    .values({
      upid: variant.upid,
      brandId,
      workingVariantId: variantId,
      firstPublishedAt: now,
      lastPublishedAt: now,
    })
    .returning({
      id: productPassports.id,
      upid: productPassports.upid,
      brandId: productPassports.brandId,
      workingVariantId: productPassports.workingVariantId,
      currentVersionId: productPassports.currentVersionId,
      firstPublishedAt: productPassports.firstPublishedAt,
      lastPublishedAt: productPassports.lastPublishedAt,
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
      firstPublishedAt: productPassports.firstPublishedAt,
      lastPublishedAt: productPassports.lastPublishedAt,
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
      firstPublishedAt: productPassports.firstPublishedAt,
      lastPublishedAt: productPassports.lastPublishedAt,
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
      firstPublishedAt: productPassports.firstPublishedAt,
      lastPublishedAt: productPassports.lastPublishedAt,
      createdAt: productPassports.createdAt,
      updatedAt: productPassports.updatedAt,
    })
    .from(productPassports)
    .where(
      // Check if workingVariantId is in the list of variant IDs
      // Using a manual filter since the list is typically small
      eq(productPassports.brandId, productPassports.brandId), // placeholder - we'll filter in JS
    );

  // Filter to only passports whose workingVariantId is in our list
  return passports.filter(
    (p) => p.workingVariantId && variantIds.includes(p.workingVariantId),
  );
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
      lastPublishedAt: now,
      updatedAt: now,
    })
    .where(eq(productPassports.id, passportId))
    .returning({
      id: productPassports.id,
      upid: productPassports.upid,
      brandId: productPassports.brandId,
      workingVariantId: productPassports.workingVariantId,
      currentVersionId: productPassports.currentVersionId,
      firstPublishedAt: productPassports.firstPublishedAt,
      lastPublishedAt: productPassports.lastPublishedAt,
      createdAt: productPassports.createdAt,
      updatedAt: productPassports.updatedAt,
    });

  return updated ?? null;
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
