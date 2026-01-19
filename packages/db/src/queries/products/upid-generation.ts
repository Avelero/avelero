/**
 * Centralized UPID generation with global uniqueness checking.
 *
 * IMPORTANT: This is the ONLY function that should be used for generating UPIDs
 * for product variants. It ensures uniqueness across BOTH:
 * - product_variants table
 * - product_passports table (for orphaned passports that retain their UPIDs)
 *
 * All variant creation code paths MUST use this function to prevent UPID collisions.
 */

import { eq, inArray } from "drizzle-orm";
import type { Database } from "../../client";
import { productPassports, productVariants } from "../../schema";
import { generateUniqueUpids as generateUpidsBase } from "../../utils/upid";

/**
 * Generate globally unique UPIDs for product variants.
 *
 * This function MUST be used for all UPID generation to ensure uniqueness
 * across the entire system. It checks both the product_variants table
 * and the product_passports table (for orphaned passports).
 *
 * Why check product_passports?
 * When variants are deleted, their associated passports are orphaned (not deleted).
 * Orphaned passports retain their original UPIDs forever to ensure QR codes
 * remain resolvable. If we only checked product_variants, we could generate
 * a UPID that matches an orphaned passport, breaking the uniqueness constraint.
 *
 * @param db - Database instance (can be base Database or transaction)
 * @param count - Number of UPIDs to generate
 * @returns Array of globally unique UPIDs
 *
 * @example
 * ```ts
 * // Generate a single UPID
 * const [upid] = await generateGloballyUniqueUpids(db, 1);
 *
 * // Generate multiple UPIDs for batch operations
 * const upids = await generateGloballyUniqueUpids(db, variants.length);
 * ```
 */
export async function generateGloballyUniqueUpids(
  db: Database,
  count: number,
): Promise<string[]> {
  if (count <= 0) return [];

  return generateUpidsBase({
    count,
    isTaken: async (candidate: string) => {
      // Check both tables in parallel for maximum efficiency
      const [[variantExists], [passportExists]] = await Promise.all([
        db
          .select({ id: productVariants.id })
          .from(productVariants)
          .where(eq(productVariants.upid, candidate))
          .limit(1),
        db
          .select({ id: productPassports.id })
          .from(productPassports)
          .where(eq(productPassports.upid, candidate))
          .limit(1),
      ]);
      return !!(variantExists || passportExists);
    },
    fetchTakenSet: async (candidates: readonly string[]) => {
      // Fetch from both tables in parallel for batch efficiency
      const [variantUpids, passportUpids] = await Promise.all([
        db
          .select({ upid: productVariants.upid })
          .from(productVariants)
          .where(inArray(productVariants.upid, candidates as string[])),
        db
          .select({ upid: productPassports.upid })
          .from(productPassports)
          .where(inArray(productPassports.upid, candidates as string[])),
      ]);

      const taken = new Set<string>();
      for (const row of variantUpids) {
        if (row.upid) taken.add(row.upid);
      }
      for (const row of passportUpids) {
        if (row.upid) taken.add(row.upid);
      }
      return taken;
    },
  });
}
