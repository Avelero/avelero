/**
 * Product passport dirty-marking helpers.
 */

import { and, eq, inArray } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../client";
import { productPassports, productVariants, products } from "../../schema";
import { batchCreatePassportsForVariants } from "./passports";

/**
 * Result of a dirty-marking operation.
 */
export interface MarkDirtyResult {
  marked: number;
  passportIds: string[];
}

/**
 * Published working variant plus any existing passport row.
 */
interface PublishedVariantPassportRow {
  variantId: string;
  passportId: string | null;
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
 * Load published variants alongside any existing passport rows.
 *
 * @param db - Database instance or transaction
 * @param filters - Variant/product/brand scope to inspect
 * @returns Published variants with nullable passport IDs
 */
async function loadPublishedVariantPassports(
  db: DatabaseOrTransaction,
  filters: {
    brandId?: string;
    productIds?: string[];
    variantIds?: string[];
  },
): Promise<PublishedVariantPassportRow[]> {
  // Build a narrow published-variant scope so dirty-marking never touches drafts.
  const conditions = [eq(products.status, "published")];

  if (filters.brandId) {
    conditions.push(eq(products.brandId, filters.brandId));
  }

  if (filters.productIds && filters.productIds.length > 0) {
    conditions.push(inArray(products.id, filters.productIds));
  }

  if (filters.variantIds && filters.variantIds.length > 0) {
    conditions.push(inArray(productVariants.id, filters.variantIds));
  }

  return db
    .select({
      variantId: productVariants.id,
      passportId: productPassports.id,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(
      productPassports,
      eq(productPassports.workingVariantId, productVariants.id),
    )
    .where(and(...conditions));
}

/**
 * Ensure each published variant has a passport row before dirty-marking.
 *
 * @param db - Database instance or transaction
 * @param variants - Published variants in scope
 * @returns Passport IDs covering both existing and newly created passports
 */
async function ensurePassportsForPublishedVariants(
  db: DatabaseOrTransaction,
  variants: PublishedVariantPassportRow[],
): Promise<string[]> {
  // Preserve existing passport IDs and only create rows for missing variants.
  const passportIds = variants.flatMap((variant) =>
    variant.passportId ? [variant.passportId] : [],
  );
  const variantsWithoutPassport: string[] = [];

  for (const variant of variants) {
    if (variant.passportId) {
      continue;
    }

    variantsWithoutPassport.push(variant.variantId);
  }

  if (variantsWithoutPassport.length > 0) {
    const createdPassports = await batchCreatePassportsForVariants(
      db,
      variantsWithoutPassport,
    );
    passportIds.push(...createdPassports.map((passport) => passport.id));
  }

  return passportIds;
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

  const publishedVariants = await loadPublishedVariantPassports(db, {
    variantIds: [...new Set(variantIds)],
  });
  const passportIds = await ensurePassportsForPublishedVariants(
    db,
    publishedVariants,
  );

  return markDirtyByPassportIds(db, passportIds);
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

  const publishedVariants = await loadPublishedVariantPassports(db, {
    brandId,
    productIds: [...new Set(productIds)],
  });
  const passportIds = await ensurePassportsForPublishedVariants(
    db,
    publishedVariants,
  );

  return markDirtyByPassportIds(db, passportIds);
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
  const publishedVariants = await loadPublishedVariantPassports(db, {
    brandId,
  });
  const passportIds = await ensurePassportsForPublishedVariants(
    db,
    publishedVariants,
  );

  return markDirtyByPassportIds(db, passportIds);
}
