import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import type { Database } from "../../client";
import {
  brandInvites,
  brandLifecycle,
  brandMembers,
  brandPlan,
  brands,
  users,
} from "../../schema";

export type BrandInviteRole = "owner" | "member";

export interface UserInviteSummaryRow {
  id: string;
  email: string;
  role: BrandInviteRole;
  createdAt: string;
  expiresAt: string | null;
  brandId: string | null;
  brandName: string | null;
  brandLogoPath: string | null;
  invitedById: string | null;
  invitedByEmail: string | null;
  invitedByFullName: string | null;
  invitedByAvatarPath: string | null;
}

export async function listBrandInvites(
  db: Database,
  userId: string,
  brandId: string,
) {
  // Ensure membership exists
  const mem = await db
    .select({ id: brandMembers.id })
    .from(brandMembers)
    .where(
      and(
        eq(brandMembers.brandId, brandId),
        eq(brandMembers.userId, userId),
        inArray(brandMembers.role, ["owner", "avelero"]),
      ),
    )
    .limit(1);
  if (!mem.length) throw new Error("FORBIDDEN");

  // Only return pending invites that haven't expired
  const nowIso = new Date().toISOString();
  const rows = await db
    .select({
      id: brandInvites.id,
      email: brandInvites.email,
      role: brandInvites.role,
      expires_at: brandInvites.expiresAt,
      created_at: brandInvites.createdAt,
    })
    .from(brandInvites)
    .where(
      and(
        eq(brandInvites.brandId, brandId),
        // Only include invites that haven't expired (null expiry = never expires)
        or(isNull(brandInvites.expiresAt), gt(brandInvites.expiresAt, nowIso)),
      ),
    )
    .orderBy(desc(brandInvites.createdAt));
  return { data: rows } as const;
}

export async function listInvitesByEmail(db: Database, email: string) {
  const rows = await listPendingInvitesForEmail(db, email);
  const data = rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    expires_at: row.expiresAt,
    brand: {
      id: row.brandId,
      name: row.brandName,
      logo_path: row.brandLogoPath,
    },
  }));
  return { data } as const;
}

export async function listPendingInvitesForEmail(
  db: Database,
  email: string,
): Promise<UserInviteSummaryRow[]> {
  const normalizedEmail = email.trim().toLowerCase();
  const nowIso = new Date().toISOString();
  const rows = await db
    .select({
      id: brandInvites.id,
      email: brandInvites.email,
      role: brandInvites.role,
      createdAt: brandInvites.createdAt,
      expires_at: brandInvites.expiresAt,
      brandId: brands.id,
      brandName: brands.name,
      brandLogoPath: brands.logoPath,
      invitedById: brandInvites.createdBy,
      invitedByEmail: users.email,
      invitedByFullName: users.fullName,
      invitedByAvatarPath: users.avatarPath,
    })
    .from(brandInvites)
    .leftJoin(brands, eq(brandInvites.brandId, brands.id))
    .leftJoin(users, eq(brandInvites.createdBy, users.id))
    .where(
      and(
        sql`LOWER(TRIM(BOTH FROM "brand_invites"."email")) = ${normalizedEmail}`,
        or(isNull(brandInvites.expiresAt), gt(brandInvites.expiresAt, nowIso)),
      ),
    )
    .orderBy(desc(brandInvites.createdAt));
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role as BrandInviteRole,
    createdAt: row.createdAt,
    expiresAt: row.expires_at,
    brandId: row.brandId ?? null,
    brandName: row.brandName ?? null,
    brandLogoPath: row.brandLogoPath ?? null,
    invitedById: row.invitedById ?? null,
    invitedByEmail: row.invitedByEmail ?? null,
    invitedByFullName: row.invitedByFullName ?? null,
    invitedByAvatarPath: row.invitedByAvatarPath ?? null,
  }));
}

export async function revokeBrandInviteByOwner(
  db: Database,
  userId: string,
  inviteId: string,
) {
  const invite = await db
    .select({ id: brandInvites.id, brandId: brandInvites.brandId })
    .from(brandInvites)
    .where(eq(brandInvites.id, inviteId))
    .limit(1);
  const row = invite[0];
  if (!row) throw new Error("NOT_FOUND");

  const owner = await db
    .select({ id: brandMembers.id })
    .from(brandMembers)
    .where(
      and(
        eq(brandMembers.userId, userId),
        eq(brandMembers.brandId, row.brandId),
        inArray(brandMembers.role, ["owner", "avelero"]),
      ),
    )
    .limit(1);
  if (!owner.length) throw new Error("FORBIDDEN");

  await db.delete(brandInvites).where(eq(brandInvites.id, inviteId));
  return { success: true as const };
}

type CreateInvitesParams = {
  brandId: string;
  invites: { email: string; role: "owner" | "member"; createdBy: string }[];
};

export async function createBrandInvites(
  db: Database,
  params: CreateInvitesParams,
) {
  const nowIso = new Date().toISOString();
  const emails = params.invites.map((i) => i.email.toLowerCase());

  // existing members
  const members = await db
    .select({ email: users.email })
    .from(brandMembers)
    .leftJoin(users, eq(brandMembers.userId, users.id))
    .where(
      and(
        eq(brandMembers.brandId, params.brandId),
        or(...emails.map((e) => sql`LOWER("users"."email") = ${e}`)),
      ),
    );
  const memberEmails = new Set(
    members.map((m) => m.email?.toLowerCase()).filter(Boolean),
  );

  // pending invites
  const pending = await db
    .select({ email: brandInvites.email })
    .from(brandInvites)
    .where(
      and(
        eq(brandInvites.brandId, params.brandId),
        or(isNull(brandInvites.expiresAt), gt(brandInvites.expiresAt, nowIso)),
        or(...emails.map((e) => sql`LOWER("brand_invites"."email") = ${e}`)),
      ),
    );
  const pendingEmails = new Set(
    pending.map((p) => p.email?.toLowerCase()).filter(Boolean),
  );

  const uniqueInvites = params.invites.filter(
    (invite, idx, arr) =>
      idx ===
      arr.findIndex(
        (i) => i.email.toLowerCase() === invite.email.toLowerCase(),
      ),
  );

  const valid = uniqueInvites.filter(
    (i) =>
      !memberEmails.has(i.email.toLowerCase()) &&
      !pendingEmails.has(i.email.toLowerCase()),
  );
  const skipped: Array<{
    email: string;
    reason: "already_member" | "already_invited" | "seat_limit_reached";
  }> = uniqueInvites
    .filter((i) => !valid.includes(i))
    .map((i) => ({
      email: i.email.toLowerCase(),
      reason: memberEmails.has(i.email.toLowerCase())
        ? "already_member"
        : ("already_invited" as const),
    }));

  // Seat check (null maxSeats = unlimited). Exclude hidden avelero members.
  let insertsAllowed = valid.length;
  const [plan] = await db
    .select({ maxSeats: brandPlan.maxSeats })
    .from(brandPlan)
    .where(eq(brandPlan.brandId, params.brandId))
    .limit(1);

  if (typeof plan?.maxSeats === "number") {
    const [memberCountRow] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(brandMembers)
      .where(
        and(
          eq(brandMembers.brandId, params.brandId),
          inArray(brandMembers.role, ["owner", "member"]),
        ),
      );

    const [pendingCountRow] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(brandInvites)
      .where(
        and(
          eq(brandInvites.brandId, params.brandId),
          or(isNull(brandInvites.expiresAt), gt(brandInvites.expiresAt, nowIso)),
        ),
      );

    const currentSeats = (memberCountRow?.count ?? 0) + (pendingCountRow?.count ?? 0);
    const availableSeats = Math.max(0, plan.maxSeats - currentSeats);
    insertsAllowed = Math.min(valid.length, availableSeats);
  }

  if (valid.length === 0)
    return { results: [], skippedInvites: skipped } as const;

  const creatable = valid.slice(0, insertsAllowed);
  const overflow = valid.slice(insertsAllowed);
  for (const invite of overflow) {
    skipped.push({
      email: invite.email.toLowerCase(),
      reason: "seat_limit_reached",
    });
  }

  if (creatable.length === 0)
    return { results: [], skippedInvites: skipped } as const;

  const inserted = await Promise.all(
    creatable.map(async (i) => {
      const emailLower = i.email.toLowerCase();

      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`LOWER("users"."email") = ${emailLower}`)
        .limit(1);
      const isExistingUser = existingUser.length > 0;

      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const [row] = await db
        .insert(brandInvites)
        .values({
          brandId: params.brandId,
          email: emailLower,
          role: i.role,
          createdBy: i.createdBy,
          tokenHash,
          expiresAt,
        })
        .onConflictDoNothing()
        .returning({
          id: brandInvites.id,
          email: brandInvites.email,
          role: brandInvites.role,
          brandId: brandInvites.brandId,
          tokenHash: brandInvites.tokenHash,
        });
      if (!row) return null;
      const brand = await db
        .select({ id: brands.id, name: brands.name })
        .from(brands)
        .where(eq(brands.id, params.brandId))
        .limit(1);
      return {
        email: row.email,
        role: row.role,
        brand: brand[0] ?? null,
        tokenHash: row.tokenHash ?? null,
        isExistingUser,
      } as const;
    }),
  );

  return {
    results: inserted.filter(Boolean),
    skippedInvites: skipped,
  } as const;
}

export async function acceptBrandInvite(
  db: Database,
  params: { id: string; userId: string },
) {
  return db.transaction(async (tx) => {
    const now = new Date();
    const nowIso = now.toISOString();
    const trialEndsAtIso = new Date(
      now.getTime() + 14 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const invite = await tx
      .select({
        id: brandInvites.id,
        email: brandInvites.email,
        role: brandInvites.role,
        brandId: brandInvites.brandId,
        expiresAt: brandInvites.expiresAt,
      })
      .from(brandInvites)
      .where(eq(brandInvites.id, params.id))
      .limit(1);
    const row = invite[0];
    if (!row) throw new Error("Invite not found");
    if (row.expiresAt && row.expiresAt <= nowIso) {
      throw new Error("Invite not found or expired");
    }

    const [userRow] = await tx
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, params.userId))
      .limit(1);
    const userEmail = userRow?.email?.trim().toLowerCase();
    if (!userEmail) {
      throw new Error("Authenticated user email is missing");
    }
    if (row.email.trim().toLowerCase() !== userEmail) {
      throw new Error("Invite does not belong to the current user");
    }

    await tx
      .insert(brandMembers)
      .values({ userId: params.userId, brandId: row.brandId, role: row.role })
      .onConflictDoUpdate({
        target: [brandMembers.userId, brandMembers.brandId],
        set: { role: row.role },
      });

    // First non-admin invite acceptance on demo transitions to trial.
    if (row.role === "owner" || row.role === "member") {
      await tx
        .update(brandLifecycle)
        .set({
          phase: "trial",
          phaseChangedAt: nowIso,
          trialStartedAt: nowIso,
          trialEndsAt: trialEndsAtIso,
        })
        .where(
          and(
            eq(brandLifecycle.brandId, row.brandId),
            eq(brandLifecycle.phase, "demo"),
          ),
        );
    }

    await tx
      .update(users)
      .set({ brandId: row.brandId })
      .where(eq(users.id, params.userId));

    await tx.delete(brandInvites).where(eq(brandInvites.id, params.id));
    return { brandId: row.brandId } as const;
  });
}

export async function declineBrandInvite(
  db: Database,
  params: { id: string; email: string },
) {
  const { id, email } = params;
  const normalizedEmail = email.trim().toLowerCase();
  await db
    .delete(brandInvites)
    .where(
      and(
        eq(brandInvites.id, id),
        sql`LOWER(TRIM(BOTH FROM "brand_invites"."email")) = ${normalizedEmail}`,
      ),
    );
  return { success: true as const };
}
