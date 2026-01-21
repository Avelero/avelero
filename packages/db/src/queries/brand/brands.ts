import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import type { Database } from "../../client";
import {
  DEFAULT_THEME_CONFIG,
  DEFAULT_THEME_STYLES,
} from "../../defaults/theme-defaults";
import { brandMembers, brandTheme, brands, users } from "../../schema";

// Type for database operations that works with both regular db and transactions
type DatabaseLike = Pick<Database, "select">;

export type BrandMembershipListItem = {
  id: string;
  name: string;
  slug: string | null;
  email: string | null;
  logo_path: string | null;
  country_code: string | null;
  role: "owner" | "member";
};

// =============================================================================
// SLUG UTILITIES
// =============================================================================

/**
 * Generates a URL-friendly slug from a brand name.
 */
export function generateSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Checks if a slug is already taken by another brand.
 */
export async function isSlugTaken(
  db: Database,
  slug: string,
  excludeBrandId?: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: brands.id })
    .from(brands)
    .where(
      excludeBrandId
        ? and(eq(brands.slug, slug), ne(brands.id, excludeBrandId))
        : eq(brands.slug, slug),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Generates a unique slug by appending a counter if needed.
 */
export async function generateUniqueSlug(
  db: Database,
  baseName: string,
  excludeBrandId?: string,
): Promise<string> {
  const baseSlug = generateSlugFromName(baseName);
  if (!baseSlug) {
    return `brand-${Date.now()}`;
  }

  let slug = baseSlug;
  let counter = 1;

  while (await isSlugTaken(db, slug, excludeBrandId)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
    if (counter > 100) {
      slug = `${baseSlug}-${Date.now()}`;
      break;
    }
  }

  return slug;
}

/**
 * Fetches a brand by its slug.
 */
export async function getBrandBySlug(
  db: Database,
  slug: string,
): Promise<{ id: string; name: string; slug: string } | null> {
  const [row] = await db
    .select({
      id: brands.id,
      name: brands.name,
      slug: brands.slug,
    })
    .from(brands)
    .where(eq(brands.slug, slug))
    .limit(1);

  if (!row || !row.slug) return null;
  return { id: row.id, name: row.name, slug: row.slug };
}

/**
 * Compute the next active brand for a user, excluding a specific brand if provided.
 */
export async function computeNextBrandIdForUser(
  db: DatabaseLike,
  userId: string,
  excludeBrandId?: string | null,
): Promise<string | null> {
  const conditions = [
    eq(brandMembers.userId, userId),
    isNull(brands.deletedAt),
  ];
  if (excludeBrandId) {
    conditions.push(ne(brandMembers.brandId, excludeBrandId));
  }

  const rows = await db
    .select({ brandId: brandMembers.brandId, name: brands.name })
    .from(brandMembers)
    .innerJoin(brands, eq(brandMembers.brandId, brands.id))
    .where(and(...conditions))
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
  slug: brands.slug,
  email: brands.email,
  logo_path: brands.logoPath,
  country_code: brands.countryCode,
  role: brandMembers.role,
} as const;

/**
 * Type-safe brand field names.
 */
export type BrandField = keyof typeof BRAND_FIELD_MAP;

/**
 * Gets owner counts for multiple brands in a single query.
 */
export async function getOwnerCountsByBrandIds(
  db: Database,
  brandIds: string[],
): Promise<Map<string, number>> {
  if (brandIds.length === 0) return new Map();

  const rows = await db
    .select({
      brandId: brandMembers.brandId,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(brandMembers)
    .where(
      and(
        inArray(brandMembers.brandId, brandIds),
        eq(brandMembers.role, "owner"),
      ),
    )
    .groupBy(brandMembers.brandId);

  const ownerCounts = new Map<string, number>();
  for (const row of rows) {
    ownerCounts.set(row.brandId, row.count);
  }
  return ownerCounts;
}

/**
 * Gets brands for a user with optional field selection.
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
      slug: brands.slug,
      email: brands.email,
      logo_path: brands.logoPath,
      country_code: brands.countryCode,
      role: brandMembers.role,
    })
    .from(brandMembers)
    .leftJoin(brands, eq(brandMembers.brandId, brands.id))
    .where(and(eq(brandMembers.userId, userId), isNull(brands.deletedAt)))
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
        slug: row.slug,
        email: row.email,
        logo_path: row.logo_path,
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
    slug?: string | null;
    email?: string | null;
    country_code?: string | null;
    logo_path?: string | null;
  },
) {
  let slug: string;
  if (input.slug) {
    const taken = await isSlugTaken(db, input.slug);
    if (taken) {
      throw new Error("This slug is already taken");
    }
    slug = input.slug;
  } else {
    slug = await generateUniqueSlug(db, input.name);
  }

  const [brand] = await db
    .insert(brands)
    .values({
      name: input.name,
      slug,
      email: input.email ?? null,
      countryCode: input.country_code ?? null,
      logoPath: input.logo_path ?? null,
    })
    .returning({ id: brands.id, slug: brands.slug });
  if (!brand) throw new Error("Failed to create brand");

  // Seed default theme configuration for the new brand
  await db.insert(brandTheme).values({
    brandId: brand.id,
    themeStyles: DEFAULT_THEME_STYLES,
    themeConfig: DEFAULT_THEME_CONFIG,
  });

  await db
    .insert(brandMembers)
    .values({ userId, brandId: brand.id, role: "owner" });

  await db.update(users).set({ brandId: brand.id }).where(eq(users.id, userId));

  return { id: brand.id, slug: brand.slug } as const;
}

export async function updateBrand(
  db: Database,
  userId: string,
  input: { id: string } & Partial<{
    name: string;
    slug: string | null;
    email: string | null;
    country_code: string | null;
    logo_path: string | null;
  }>,
): Promise<{ success: true; slug: string | null }> {
  const membership = await db
    .select({ id: brandMembers.id })
    .from(brandMembers)
    .where(
      and(eq(brandMembers.brandId, input.id), eq(brandMembers.userId, userId)),
    )
    .limit(1);
  if (!membership.length) throw new Error("FORBIDDEN");

  const { id, ...payload } = input;

  const updateData: Partial<{
    name: string;
    slug: string | null;
    email: string | null;
    countryCode: string | null;
    logoPath: string | null;
  }> = {};

  if (payload.name !== undefined) updateData.name = payload.name;
  if (payload.slug !== undefined) {
    if (payload.slug !== null) {
      const taken = await isSlugTaken(db, payload.slug, id);
      if (taken) {
        throw new Error("This slug is already taken");
      }
    }
    updateData.slug = payload.slug;
  }
  if (payload.email !== undefined) updateData.email = payload.email;
  if (payload.country_code !== undefined)
    updateData.countryCode = payload.country_code;
  if (payload.logo_path !== undefined) updateData.logoPath = payload.logo_path;

  const [row] = await db
    .update(brands)
    .set(updateData)
    .where(eq(brands.id, id))
    .returning({ id: brands.id, slug: brands.slug });
  return row
    ? { success: true as const, slug: row.slug }
    : { success: true as const, slug: null };
}

/**
 * Soft-deletes a brand and updates all affected users' active brand.
 */
export async function deleteBrand(
  db: Database,
  brandId: string,
  actingUserId: string,
): Promise<{ success: true; nextBrandId: string | null }> {
  let actingUserNextBrandId: string | null = null;

  await db.transaction(async (tx) => {
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

    const affectedUsers = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.brandId, brandId), ne(users.id, actingUserId)));

    if (affectedUsers.length > 0) {
      const affectedUserIds = affectedUsers.map((u) => u.id);

      const allMemberships = await tx
        .select({
          userId: brandMembers.userId,
          brandId: brandMembers.brandId,
          brandName: brands.name,
        })
        .from(brandMembers)
        .innerJoin(brands, eq(brandMembers.brandId, brands.id))
        .where(
          and(
            inArray(brandMembers.userId, affectedUserIds),
            isNull(brands.deletedAt),
          ),
        )
        .orderBy(asc(brands.name));

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

      const updates = affectedUsers.map((u) => {
        const userMemberships = membershipsByUser.get(u.id) ?? [];
        const filtered = userMemberships.filter((m) => m.brandId !== brandId);
        const nextBrandId = filtered[0]?.brandId ?? null;
        return { userId: u.id, nextBrandId };
      });

      for (const { userId, nextBrandId } of updates) {
        await tx
          .update(users)
          .set({ brandId: nextBrandId })
          .where(eq(users.id, userId));
      }
    }

    const [row] = await tx
      .update(brands)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(brands.id, brandId))
      .returning({ id: brands.id });
    if (!row) throw new Error("Failed to soft-delete brand");
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
