/**
 * Product variant UPID generation helpers.
 */

import { eq, inArray } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../client";
import { productVariants } from "../../schema";
import { generateUniqueUpids as generateUpidsBase } from "../../utils/upid";

/**
 * Generate globally unique UPIDs for product variants.
 *
 * This function MUST be used for all UPID generation to ensure uniqueness
 * across live working variants.
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
  db: DatabaseOrTransaction,
  count: number,
): Promise<string[]> {
  if (count <= 0) return [];

  return generateUpidsBase({
    count,
    isTaken: async (candidate: string) => {
      // Probe the live variants table for conflicts.
      const [variantExists] = await db
        .select({ id: productVariants.id })
        .from(productVariants)
        .where(eq(productVariants.upid, candidate))
        .limit(1);

      return !!variantExists;
    },
    fetchTakenSet: async (candidates: readonly string[]) => {
      // Batch load all matching live variant UPIDs in one query.
      const variantUpids = await db
        .select({ upid: productVariants.upid })
        .from(productVariants)
        .where(inArray(productVariants.upid, candidates as string[]));

      const taken = new Set<string>();
      for (const row of variantUpids) {
        if (row.upid) taken.add(row.upid);
      }
      return taken;
    },
  });
}
