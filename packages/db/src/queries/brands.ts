import { and, asc, eq, ne } from "drizzle-orm";
import type { Database } from "../client";
import { brandMembers, brands, users } from "../schema";

// Compute the next active brand for a user, excluding a specific brand if provided.
// Strategy: first alphabetical brand by name among memberships, excluding `excludeBrandId`.
export async function computeNextBrandIdForUser(
  db: Database,
  userId: string,
  excludeBrandId?: string | null,
): Promise<string | null> {
  const rows = await db
    .select({ brandId: brandMembers.brandId, name: brands.name })
    .from(brandMembers)
    .leftJoin(brands, eq(brandMembers.brandId, brands.id))
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

export async function getBrandsByUserId(db: Database, userId: string) {
  // list brands via membership table
  const rows = await db
    .select({
      role: brandMembers.role,
      brand: {
        id: brands.id,
        name: brands.name,
        email: brands.email,
        logoPath: brands.logoPath,
        avatarHue: brands.avatarHue,
        countryCode: brands.countryCode,
      },
    })
    .from(brandMembers)
    .leftJoin(brands, eq(brandMembers.brandId, brands.id))
    .where(eq(brandMembers.userId, userId))
    .orderBy(asc(brands.name));

  return rows.map((r) => ({
    id: r.brand?.id ?? null,
    name: r.brand?.name ?? null,
    email: r.brand?.email ?? null,
    logo_path: r.brand?.logoPath ?? null,
    avatar_hue: r.brand?.avatarHue ?? null,
    country_code: r.brand?.countryCode ?? null,
    role: r.role ?? null,
  }));
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

export async function deleteBrand(
  db: Database,
  brandId: string,
  actingUserId: string,
): Promise<{ success: true; nextBrandId: string | null }> {
  // Require acting user to be an owner on the brand
  const owner = await db
    .select({ id: brandMembers.id })
    .from(brandMembers)
    .where(
      and(
        eq(brandMembers.brandId, brandId),
        eq(brandMembers.userId, actingUserId),
        eq(brandMembers.role, "owner"),
      ),
    )
    .limit(1);
  if (!owner.length) throw new Error("FORBIDDEN");

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

    for (const u of affectedUsers) {
      const nextId = await computeNextBrandIdForUser(tx, u.id, brandId);
      await tx.update(users).set({ brandId: nextId }).where(eq(users.id, u.id));
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
