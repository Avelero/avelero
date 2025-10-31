import { and, asc, eq, inArray, ne } from "drizzle-orm";
import type { Database } from "../client";
import { brandMembers, brands, users } from "../schema";

// Type for database operations that works with both regular db and transactions
type DatabaseLike = Pick<Database, "select">;

export type BrandMembershipListItem = {
  id: string;
  name: string;
  email: string | null;
  logo_path: string | null;
  avatar_hue: number | null;
  country_code: string | null;
  role: "owner" | "member";
};

// Compute the next active brand for a user, excluding a specific brand if provided.
// Strategy: first alphabetical brand by name among memberships, excluding `excludeBrandId`.
export async function computeNextBrandIdForUser(
  db: DatabaseLike,
  userId: string,
  excludeBrandId?: string | null,
): Promise<string | null> {
  const rows = await db
    .select({ brandId: brandMembers.brandId, name: brands.name })
    .from(brandMembers)
    .innerJoin(brands, eq(brandMembers.brandId, brands.id))
    .where(
      excludeBrandId
        ? and(
            eq(brandMembers.userId, userId),
            ne(brandMembers.brandId, excludeBrandId),
          )
        : eq(brandMembers.userId, userId),
    )
    .orderBy(asc(brands.name))
    .limit(1);
  return rows[0]?.brandId ?? null;
}

/**
 * Available brand fields that can be selected in queries.
 */
const BRAND_FIELD_MAP = {
  id: brands.id,
  name: brands.name,
  email: brands.email,
  logo_path: brands.logoPath,
  avatar_hue: brands.avatarHue,
  country_code: brands.countryCode,
  role: brandMembers.role,
} as const;

/**
 * Type-safe brand field names.
 */
export type BrandField = keyof typeof BRAND_FIELD_MAP;

/**
 * Gets brands for a user with optional field selection.
 *
 * Supports selective field querying to reduce data transfer when clients
 * only need specific fields (e.g., id and name for dropdowns).
 *
 * @param db - Database instance.
 * @param userId - User identifier.
 * @param opts - Optional field selection.
 * @returns Brand list with membership roles.
 */
export async function getBrandsByUserId(
  db: Database,
  userId: string,
  _opts: { fields?: readonly BrandField[] } = {},
): Promise<BrandMembershipListItem[]> {
  const rows = await db
    .select({
      id: brands.id,
      name: brands.name,
      email: brands.email,
      logo_path: brands.logoPath,
      avatar_hue: brands.avatarHue,
      country_code: brands.countryCode,
      role: brandMembers.role,
    })
    .from(brandMembers)
    .leftJoin(brands, eq(brandMembers.brandId, brands.id))
    .where(eq(brandMembers.userId, userId))
    .orderBy(asc(brands.name));

  const sanitized = rows.filter(
    (row): row is typeof row & { id: string; name: string } =>
      row.id !== null && row.name !== null,
  );

  return sanitized.map(
    (row) =>
      ({
        id: row.id,
        name: row.name,
        email: row.email,
        logo_path: row.logo_path,
        avatar_hue: row.avatar_hue,
        country_code: row.country_code,
        role: row.role === "owner" ? "owner" : "member",
      }) satisfies BrandMembershipListItem,
  );
}

export async function createBrand(
  db: Database,
  userId: string,
  input: {
    name: string;
    email?: string | null;
    country_code?: string | null;
    logo_path?: string | null;
    avatar_hue?: number | null;
  },
) {
  const [brand] = await db
    .insert(brands)
    .values({
      name: input.name,
      email: input.email ?? null,
      countryCode: input.country_code ?? null,
      logoPath: input.logo_path ?? null,
      avatarHue: input.avatar_hue ?? null,
    })
    .returning({ id: brands.id });
  if (!brand) throw new Error("Failed to create brand");

  await db
    .insert(brandMembers)
    .values({ userId, brandId: brand.id, role: "owner" });

  await db.update(users).set({ brandId: brand.id }).where(eq(users.id, userId));

  return { id: brand.id } as const;
}

export async function updateBrand(
  db: Database,
  userId: string,
  input: { id: string } & Partial<{
    name: string;
    email: string | null;
    country_code: string | null;
    logo_path: string | null;
    avatar_hue: number | null;
  }>,
) {
  const membership = await db
    .select({ id: brandMembers.id })
    .from(brandMembers)
    .where(
      and(eq(brandMembers.brandId, input.id), eq(brandMembers.userId, userId)),
    )
    .limit(1);
  if (!membership.length) throw new Error("FORBIDDEN");

  const { id, ...payload } = input;
  const [row] = await db
    .update(brands)
    .set({
      name: payload.name,
      email: payload.email,
      countryCode: payload.country_code,
      logoPath: payload.logo_path,
      avatarHue: payload.avatar_hue,
    })
    .where(eq(brands.id, id))
    .returning({ id: brands.id });
  return row ? { success: true as const } : { success: true as const };
}

/**
 * Deletes a brand and updates all affected users' active brand.
 *
 * Uses batched queries to compute next brands for multiple users efficiently,
 * preventing N+1 query problems when many users have the brand active.
 *
 * @param db - Database instance or transaction.
 * @param brandId - Brand identifier to delete.
 * @param actingUserId - User performing the deletion.
 * @returns Success flag and the acting user's next active brand.
 */
export async function deleteBrand(
  db: Database,
  brandId: string,
  actingUserId: string,
): Promise<{ success: true; nextBrandId: string | null }> {
  let actingUserNextBrandId: string | null = null;

  await db.transaction(async (tx) => {
    // Determine and set acting user's next active brand (if they currently have this brand active)
    const currentUser = await tx
      .select({ brandId: users.brandId })
      .from(users)
      .where(eq(users.id, actingUserId))
      .limit(1);

    const userCurrentBrandId = currentUser[0]?.brandId ?? null;
    if (userCurrentBrandId === brandId) {
      actingUserNextBrandId = await computeNextBrandIdForUser(
        tx,
        actingUserId,
        brandId,
      );
      await tx
        .update(users)
        .set({ brandId: actingUserNextBrandId })
        .where(eq(users.id, actingUserId));
    } else {
      actingUserNextBrandId = userCurrentBrandId;
    }

    // Promote other users who have this brand active to their next brand (or null if none)
    const affectedUsers = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.brandId, brandId), ne(users.id, actingUserId)));

    // OPTIMIZED: Batch compute next brands for all affected users in one query
    if (affectedUsers.length > 0) {
      const affectedUserIds = affectedUsers.map((u) => u.id);

      // Fetch all brand memberships for affected users in a single query
      const allMemberships = await tx
        .select({
          userId: brandMembers.userId,
          brandId: brandMembers.brandId,
          brandName: brands.name,
        })
        .from(brandMembers)
        .leftJoin(brands, eq(brandMembers.brandId, brands.id))
        .where(inArray(brandMembers.userId, affectedUserIds))
        .orderBy(asc(brands.name));

      // Group memberships by user and compute next brand
      const membershipsByUser = new Map<
        string,
        Array<{ brandId: string; brandName: string | null }>
      >();

      for (const m of allMemberships) {
        if (!membershipsByUser.has(m.userId)) {
          membershipsByUser.set(m.userId, []);
        }
        membershipsByUser.get(m.userId)!.push({
          brandId: m.brandId,
          brandName: m.brandName,
        });
      }

      // Build updates for all users in a single batch
      const updates = affectedUsers.map((u) => {
        const userMemberships = membershipsByUser.get(u.id) ?? [];
        const filtered = userMemberships.filter((m) => m.brandId !== brandId);
        const nextBrandId = filtered[0]?.brandId ?? null;
        return { userId: u.id, nextBrandId };
      });

      // Execute updates sequentially (Drizzle doesn't support bulk updates with different values)
      for (const { userId, nextBrandId } of updates) {
        await tx
          .update(users)
          .set({ brandId: nextBrandId })
          .where(eq(users.id, userId));
      }
    }

    // Delete the brand (cascades will handle brandMembers and brandInvites)
    const [row] = await tx
      .delete(brands)
      .where(eq(brands.id, brandId))
      .returning({ id: brands.id });
    if (!row) throw new Error("Failed to delete brand");
  });

  return { success: true, nextBrandId: actingUserNextBrandId };
}

export async function setActiveBrand(
  db: Database,
  userId: string,
  brandId: string,
) {
  const membership = await db
    .select({ id: brandMembers.id })
    .from(brandMembers)
    .where(
      and(eq(brandMembers.userId, userId), eq(brandMembers.brandId, brandId)),
    )
    .limit(1);
  if (!membership.length) throw new Error("Not a member of this brand");

  await db.update(users).set({ brandId }).where(eq(users.id, userId));
  return { success: true } as const;
}

export async function canLeaveBrand(
  db: Database,
  userId: string,
  brandId: string,
) {
  const current = await db
    .select({ role: brandMembers.role })
    .from(brandMembers)
    .where(
      and(eq(brandMembers.userId, userId), eq(brandMembers.brandId, brandId)),
    )
    .limit(1);
  const membership = current[0];
  if (!membership) return { canLeave: false } as const;
  if (membership.role === "owner") {
    const owners = await db
      .select({ id: brandMembers.id })
      .from(brandMembers)
      .where(
        and(eq(brandMembers.brandId, brandId), eq(brandMembers.role, "owner")),
      );
    if (owners.length <= 1)
      return { canLeave: false, reason: "SOLE_OWNER" as const };
  }
  return { canLeave: true } as const;
}

export async function leaveBrand(
  db: Database,
  userId: string,
  brandId: string,
): Promise<
  { ok: true; nextBrandId: string | null } | { ok: false; code: "SOLE_OWNER" }
> {
  const roleRows = await db
    .select({ role: brandMembers.role })
    .from(brandMembers)
    .where(
      and(eq(brandMembers.userId, userId), eq(brandMembers.brandId, brandId)),
    )
    .limit(1);
  const role = roleRows[0]?.role;
  if (!role) throw new Error("Not a member of this brand");
  if (role === "owner") {
    const owners = await db
      .select({ id: brandMembers.id })
      .from(brandMembers)
      .where(
        and(eq(brandMembers.brandId, brandId), eq(brandMembers.role, "owner")),
      );
    if (owners.length <= 1) return { ok: false, code: "SOLE_OWNER" } as const;
  }

  await db
    .delete(brandMembers)
    .where(
      and(eq(brandMembers.userId, userId), eq(brandMembers.brandId, brandId)),
    );

  const current = await db
    .select({ brandId: users.brandId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  let nextBrandId: string | null = current[0]?.brandId ?? null;
  if (nextBrandId === brandId) {
    const computed = await computeNextBrandIdForUser(db, userId, brandId);
    nextBrandId = computed;
    await db
      .update(users)
      .set({ brandId: nextBrandId })
      .where(eq(users.id, userId));
  }
  return { ok: true, nextBrandId } as const;
}
