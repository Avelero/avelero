import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { Database } from "../../client";
import { brandMembers, brands, users } from "../../schema";

/**
 * Check if an email is already in use by another user.
 *
 * @param db - Database instance
 * @param email - Email to check
 * @param excludeUserId - Optional user ID to exclude from the check (for updates)
 * @returns true if email is already taken, false otherwise
 */
export async function isEmailTaken(
  db: Database,
  email: string,
  excludeUserId?: string,
): Promise<boolean> {
  const conditions = excludeUserId
    ? and(eq(users.email, email), ne(users.id, excludeUserId))
    : eq(users.email, email);

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(conditions)
    .limit(1);

  return !!existing;
}

export async function getUserById(db: Database, id: string) {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      avatarPath: users.avatarPath,
      brandId: users.brandId,
      brand: {
        id: brands.id,
        name: brands.name,
        email: brands.email,
        logoPath: brands.logoPath,
        countryCode: brands.countryCode,
      },
    })
    .from(users)
    .leftJoin(brands, eq(users.brandId, brands.id))
    .where(eq(users.id, id));

  return rows[0] ?? null;
}

export interface UpdateUserParams {
  id: string;
  email?: string;
  fullName?: string | null;
  avatarPath?: string | null;
  brandId?: string | null;
}

export async function updateUser(db: Database, params: UpdateUserParams) {
  const { id, ...data } = params;
  const [row] = await db
    .update(users)
    .set(data)
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      avatarPath: users.avatarPath,
      brandId: users.brandId,
    });
  return row ?? null;
}

export async function deleteUser(db: Database, id: string) {
  // Get user's brands
  const userBrands = await db
    .select({ brandId: brandMembers.brandId })
    .from(brandMembers)
    .where(eq(brandMembers.userId, id));

  if (userBrands.length > 0) {
    // Count members for each brand
    const brandIds = userBrands.map((b) => b.brandId);
    const memberCounts = await db
      .select({
        brandId: brandMembers.brandId,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(brandMembers)
      .where(inArray(brandMembers.brandId, brandIds))
      .groupBy(brandMembers.brandId);

    // Identify orphan brands (only 1 member)
    const orphanBrandIds = memberCounts
      .filter((b) => b.count === 1)
      .map((b) => b.brandId);

    // Delete user (cascades brandMembers)
    await db.delete(users).where(eq(users.id, id));

    // Delete orphan brands
    if (orphanBrandIds.length > 0) {
      await db.delete(brands).where(inArray(brands.id, orphanBrandIds));
    }
  } else {
    // No brands, just delete user
    await db.delete(users).where(eq(users.id, id));
  }

  return { id };
}
