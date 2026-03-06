/**
 * Passport Dirty Marking Queries.
 *
 * Centralizes the lightweight write paths that mark published passports as dirty
 * when working-layer data changes.
 */

import { and, eq, inArray } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../client";
import { productPassports, productVariants, products } from "../../schema";

/**
 * Result of a dirty-marking operation.
 */
export interface MarkDirtyResult {
  marked: number;
  passportIds: string[];
}

/**
 * Persist dirty=true for a known set of passport IDs.
 *
 * @param db - Database instance or transaction
 * @param passportIds - Passport IDs to mark dirty
 * @returns Count and IDs of passports that transitioned to dirty
 */
async function markDirtyByPassportIds(
  db: DatabaseOrTransaction,
  passportIds: string[],
): Promise<MarkDirtyResult> {
  // Deduplicate IDs up front so repeated inputs do not inflate the UPDATE work.
  const uniquePassportIds = [...new Set(passportIds)];
  if (uniquePassportIds.length === 0) {
    return { marked: 0, passportIds: [] };
  }

  const now = new Date().toISOString();
  const updatedPassports = await db
    .update(productPassports)
    .set({
      dirty: true,
      updatedAt: now,
    })
    .where(
      and(
        inArray(productPassports.id, uniquePassportIds),
        eq(productPassports.dirty, false),
      ),
    )
    .returning({ id: productPassports.id });

  return {
    marked: updatedPassports.length,
    passportIds: updatedPassports.map((passport) => passport.id),
  };
}

/**
 * Mark a single passport dirty.
 *
 * @param db - Database instance or transaction
 * @param passportId - Passport ID to mark dirty
 * @returns Count and IDs of passports that transitioned to dirty
 */
export async function markPassportDirty(
  db: DatabaseOrTransaction,
  passportId: string,
): Promise<MarkDirtyResult> {
  // Delegate to the shared updater so single and batch paths stay identical.
  return markDirtyByPassportIds(db, [passportId]);
}

/**
 * Mark passports dirty for a set of variants, but only when their products are published.
 *
 * @param db - Database instance or transaction
 * @param variantIds - Working variant IDs to inspect
 * @returns Count and IDs of passports that transitioned to dirty
 */
export async function markPassportsDirtyByVariantIds(
  db: DatabaseOrTransaction,
  variantIds: string[],
): Promise<MarkDirtyResult> {
  // Skip empty batches so mutation paths can forward raw variant lists directly.
  if (variantIds.length === 0) {
    return { marked: 0, passportIds: [] };
  }

  const passports = await db
    .select({ id: productPassports.id })
    .from(productPassports)
    .innerJoin(
      productVariants,
      eq(productVariants.id, productPassports.workingVariantId),
    )
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(
        inArray(productVariants.id, variantIds),
        eq(products.status, "published"),
        eq(productPassports.dirty, false),
      ),
    );

  return markDirtyByPassportIds(
    db,
    passports.map((passport) => passport.id),
  );
}

/**
 * Mark passports dirty for all variants under the supplied products, but only when published.
 *
 * @param db - Database instance or transaction
 * @param brandId - Brand scope for the product IDs
 * @param productIds - Product IDs whose passports should be marked dirty
 * @returns Count and IDs of passports that transitioned to dirty
 */
export async function markPassportsDirtyByProductIds(
  db: DatabaseOrTransaction,
  brandId: string,
  productIds: string[],
): Promise<MarkDirtyResult> {
  // Skip empty batches so bulk mutation paths can pass through filtered IDs.
  if (productIds.length === 0) {
    return { marked: 0, passportIds: [] };
  }

  const passports = await db
    .select({ id: productPassports.id })
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
        eq(productPassports.dirty, false),
      ),
    );

  return markDirtyByPassportIds(
    db,
    passports.map((passport) => passport.id),
  );
}

/**
 * Mark all published passports for a brand dirty.
 *
 * @param db - Database instance or transaction
 * @param brandId - Brand whose published passports should be marked dirty
 * @returns Count and IDs of passports that transitioned to dirty
 */
export async function markAllBrandPassportsDirty(
  db: DatabaseOrTransaction,
  brandId: string,
): Promise<MarkDirtyResult> {
  // Scope the lookup to published products so unpublished data stays cold.
  const passports = await db
    .select({ id: productPassports.id })
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
        eq(productPassports.dirty, false),
      ),
    );

  return markDirtyByPassportIds(
    db,
    passports.map((passport) => passport.id),
  );
}
