import { eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../client";
import { brandMembers, brands, users } from "../schema";

export async function getUserById(db: Database, id: string) {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      avatarPath: users.avatarPath,
      avatarHue: users.avatarHue,
      brandId: users.brandId,
      brand: {
        id: brands.id,
        name: brands.name,
        logoPath: brands.logoPath,
        avatarHue: brands.avatarHue,
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
  avatarHue?: number | null;
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
      avatarHue: users.avatarHue,
      brandId: users.brandId,
    });
  return row ?? null;
}

export async function deleteUser(db: Database, id: string) {
  // Find brands where this user is a member and count members per brand
  const memberships = await db
    .select({
      brandId: brandMembers.brandId,
      memberCount: sql<number>`count(${brandMembers.userId})`.as(
        "member_count",
      ),
    })
    .from(brandMembers)
    .where(eq(brandMembers.userId, id))
    .groupBy(brandMembers.brandId);

  const brandIdsToDelete = memberships
    .filter((m) => m.memberCount === 1)
    .map((m) => m.brandId);

  await Promise.all([
    db.delete(users).where(eq(users.id, id)),
    brandIdsToDelete.length > 0
      ? db.delete(brands).where(inArray(brands.id, brandIdsToDelete))
      : Promise.resolve(),
  ]);

  return { id } as const;
}
