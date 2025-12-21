/**
 * Shared authorization helpers for brand-level access control.
 * 
 * Provides utilities for checking brand membership, ownership,
 * and preventing invalid operations (e.g., removing last owner).
 */

import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../../client";
import { brandMembers } from "../../schema";

/**
 * Checks if a user is a member of a brand.
 * 
 * @param db - Database instance
 * @param userId - User ID
 * @param brandId - Brand ID
 * @returns True if user is a member
 */
export async function isBrandMember(
  db: Database,
  userId: string,
  brandId: string,
): Promise<boolean> {
  const [member] = await db
    .select({ id: brandMembers.id })
    .from(brandMembers)
    .where(
      and(
        eq(brandMembers.userId, userId),
        eq(brandMembers.brandId, brandId),
      ),
    )
    .limit(1);
  return !!member;
}

/**
 * Checks if a user is an owner of a brand.
 * 
 * @param db - Database instance
 * @param userId - User ID
 * @param brandId - Brand ID
 * @returns True if user is an owner
 */
export async function isBrandOwner(
  db: Database,
  userId: string,
  brandId: string,
): Promise<boolean> {
  const [owner] = await db
    .select({ id: brandMembers.id })
    .from(brandMembers)
    .where(
      and(
        eq(brandMembers.userId, userId),
        eq(brandMembers.brandId, brandId),
        eq(brandMembers.role, "owner"),
      ),
    )
    .limit(1);
  return !!owner;
}

/**
 * Gets the count of owners for a brand.
 * 
 * @param db - Database instance
 * @param brandId - Brand ID
 * @returns Number of owners
 */
export async function getOwnerCount(
  db: Database,
  brandId: string,
): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(brandMembers)
    .where(
      and(
        eq(brandMembers.brandId, brandId),
        eq(brandMembers.role, "owner"),
      ),
    );
  return result?.count ?? 0;
}

/**
 * Asserts that a user is an owner of a brand.
 * Throws an error if not.
 * 
 * @param db - Database instance
 * @param userId - User ID
 * @param brandId - Brand ID
 * @throws Error if user is not an owner
 */
export async function assertBrandOwner(
  db: Database,
  userId: string,
  brandId: string,
): Promise<void> {
  const isOwner = await isBrandOwner(db, userId, brandId);
  if (!isOwner) {
    throw new Error("FORBIDDEN: User must be a brand owner");
  }
}

/**
 * Checks if removing a user would leave the brand without owners.
 * 
 * @param db - Database instance
 * @param brandId - Brand ID
 * @param userId - User ID to check
 * @returns True if user is the last owner
 */
export async function isLastOwner(
  db: Database,
  brandId: string,
  userId: string,
): Promise<boolean> {
  const ownerCount = await getOwnerCount(db, brandId);
  if (ownerCount <= 1) {
    // Check if this user is the owner
    return await isBrandOwner(db, userId, brandId);
  }
  return false;
}








