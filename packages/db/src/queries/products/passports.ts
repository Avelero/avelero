/**
 * Product passport query helpers.
 *
 * Passports are strict publish-state children of working variants. Public
 * identifiers live on variants, while passports only track publish metadata.
 */

import { and, eq, inArray } from "drizzle-orm";
import type { Database, DatabaseOrTransaction } from "../../client";
import { productPassports, productVariants } from "../../schema";

/**
 * Canonical select shape used across passport helpers.
 */
const PRODUCT_PASSPORT_SELECT = {
  id: productPassports.id,
  workingVariantId: productPassports.workingVariantId,
  currentVersionId: productPassports.currentVersionId,
  dirty: productPassports.dirty,
  firstPublishedAt: productPassports.firstPublishedAt,
  createdAt: productPassports.createdAt,
  updatedAt: productPassports.updatedAt,
} as const;

/**
 * Shared passport record type.
 */
export type ProductPassportRecord = {
  id: string;
  workingVariantId: string;
  currentVersionId: string | null;
  dirty: boolean;
  firstPublishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Create a new passport for a working variant.
 */
export async function createProductPassport(
  db: DatabaseOrTransaction,
  variantId: string,
): Promise<ProductPassportRecord> {
  // Ensure the parent variant exists before creating its publish-state row.
  const [variant] = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1);

  if (!variant) {
    throw new Error(`Variant not found: ${variantId}`);
  }

  const [passport] = await db
    .insert(productPassports)
    .values({
      workingVariantId: variantId,
      firstPublishedAt: null,
    })
    .returning(PRODUCT_PASSPORT_SELECT);

  if (!passport) {
    throw new Error(`Failed to create passport for variant ${variantId}`);
  }

  return passport;
}

/**
 * Get the passport row for a working variant.
 */
export async function getPassportByVariantId(
  db: DatabaseOrTransaction,
  variantId: string,
): Promise<ProductPassportRecord | null> {
  // Fetch the publish-state row attached to the supplied variant.
  const [passport] = await db
    .select(PRODUCT_PASSPORT_SELECT)
    .from(productPassports)
    .where(eq(productPassports.workingVariantId, variantId))
    .limit(1);

  return passport ?? null;
}

/**
 * Get all passports for the variants belonging to one product.
 */
export async function getPassportsForProduct(
  db: Database,
  productId: string,
): Promise<ProductPassportRecord[]> {
  // Resolve product variants first so the passport lookup stays narrow.
  const variants = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(eq(productVariants.productId, productId));

  if (variants.length === 0) {
    return [];
  }

  return db
    .select(PRODUCT_PASSPORT_SELECT)
    .from(productPassports)
    .where(
      inArray(
        productPassports.workingVariantId,
        variants.map((variant) => variant.id),
      ),
    );
}

/**
 * Update the active version pointer after publishing.
 */
export async function updatePassportCurrentVersion(
  db: DatabaseOrTransaction,
  passportId: string,
  versionId: string,
): Promise<ProductPassportRecord | null> {
  // Promote the supplied version to be the passport's active snapshot.
  const [passport] = await db
    .update(productPassports)
    .set({
      currentVersionId: versionId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(productPassports.id, passportId))
    .returning(PRODUCT_PASSPORT_SELECT);

  return passport ?? null;
}

/**
 * Clear the dirty flag for a single passport.
 */
export async function clearDirtyFlag(
  db: DatabaseOrTransaction,
  passportId: string,
): Promise<ProductPassportRecord | null> {
  // Only clear rows that are currently dirty so the helper stays idempotent.
  const [passport] = await db
    .update(productPassports)
    .set({
      dirty: false,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(productPassports.id, passportId),
        eq(productPassports.dirty, true),
      ),
    )
    .returning(PRODUCT_PASSPORT_SELECT);

  return passport ?? null;
}

/**
 * Clear the dirty flag for multiple passports.
 */
export async function batchClearDirtyFlags(
  db: DatabaseOrTransaction,
  passportIds: string[],
): Promise<{ cleared: number }> {
  // Ignore empty batches so callers can forward raw IDs safely.
  const uniquePassportIds = Array.from(new Set(passportIds));
  if (uniquePassportIds.length === 0) {
    return { cleared: 0 };
  }

  const cleared = await db
    .update(productPassports)
    .set({
      dirty: false,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        inArray(productPassports.id, uniquePassportIds),
        eq(productPassports.dirty, true),
      ),
    )
    .returning({ id: productPassports.id });

  return { cleared: cleared.length };
}

/**
 * Return the existing passport for a variant or create one lazily.
 */
export async function getOrCreatePassport(
  db: DatabaseOrTransaction,
  variantId: string,
): Promise<{ passport: ProductPassportRecord; isNew: boolean }> {
  // Reuse the existing passport to keep version history attached to one row.
  const existing = await getPassportByVariantId(db, variantId);
  if (existing) {
    return { passport: existing, isNew: false };
  }

  return {
    passport: await createProductPassport(db, variantId),
    isNew: true,
  };
}

/**
 * Batch create missing passports for working variants.
 */
export async function batchCreatePassportsForVariants(
  db: DatabaseOrTransaction,
  variantIds: string[],
): Promise<ProductPassportRecord[]> {
  // Create one publish-state row per unique variant ID.
  const uniqueVariantIds = Array.from(new Set(variantIds));
  if (uniqueVariantIds.length === 0) {
    return [];
  }

  const existingRows = await db
    .select({ workingVariantId: productPassports.workingVariantId })
    .from(productPassports)
    .where(inArray(productPassports.workingVariantId, uniqueVariantIds));

  const existingVariantIds = new Set(
    existingRows.map((row) => row.workingVariantId),
  );
  const missingVariantIds = uniqueVariantIds.filter(
    (variantId) => !existingVariantIds.has(variantId),
  );

  if (missingVariantIds.length === 0) {
    return [];
  }

  return db
    .insert(productPassports)
    .values(
      missingVariantIds.map((variantId) => ({
        workingVariantId: variantId,
        firstPublishedAt: null,
      })),
    )
    .returning(PRODUCT_PASSPORT_SELECT);
}
