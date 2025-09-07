import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../client";
import { brandMembers, brands, users } from "../schema";

export async function getBrandsByUserId(db: Database, userId: string) {
  // list brands via membership table
  const rows = await db
    .select({
      role: brandMembers.role,
      brand: {
        id: brands.id,
        name: brands.name,
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
    country_code?: string | null;
    logo_path?: string | null;
    avatar_hue?: number | null;
  },
) {
  const [brand] = await db
    .insert(brands)
    .values({
      name: input.name,
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
) {
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

  const [row] = await db
    .delete(brands)
    .where(eq(brands.id, brandId))
    .returning({ id: brands.id });
  return { success: !!row } as const;
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
    const next = await db
      .select({ brandId: brandMembers.brandId })
      .from(brandMembers)
      .leftJoin(brands, eq(brandMembers.brandId, brands.id))
      .where(eq(brandMembers.userId, userId))
      .orderBy(asc(brands.name))
      .limit(1);
    nextBrandId = next[0]?.brandId ?? null;
    await db
      .update(users)
      .set({ brandId: nextBrandId })
      .where(eq(users.id, userId));
  }
  return { ok: true, nextBrandId } as const;
}
