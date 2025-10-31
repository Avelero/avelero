import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../client";
import { brandMembers } from "../schema";

export class BrandMemberForbiddenError extends Error {
  constructor() {
    super("FORBIDDEN");
    this.name = "BrandMemberForbiddenError";
  }
}

export class BrandMemberSoleOwnerError extends Error {
  constructor() {
    super("SOLE_OWNER");
    this.name = "BrandMemberSoleOwnerError";
  }
}

export interface BrandMemberRecord {
  readonly userId: string;
  readonly role: "owner" | "member" | null;
  readonly createdAt: string;
}

export async function getMembersByBrandId(
  db: Database,
  brandId: string,
): Promise<BrandMemberRecord[]> {
  const rows = await db
    .select({
      userId: brandMembers.userId,
      role: brandMembers.role,
      createdAt: brandMembers.createdAt,
    })
    .from(brandMembers)
    .where(eq(brandMembers.brandId, brandId))
    .orderBy(asc(brandMembers.createdAt));

  return rows.map((row) => ({
    userId: row.userId,
    role: row.role === "owner" || row.role === "member" ? row.role : null,
    createdAt: row.createdAt,
  }));
}

export async function updateMemberRole(
  db: Database,
  actingUserId: string,
  brandId: string,
  userId: string,
  role: "owner" | "member",
) {
  await db
    .update(brandMembers)
    .set({ role })
    .where(
      and(eq(brandMembers.brandId, brandId), eq(brandMembers.userId, userId)),
    );
  return { success: true } as const;
}

export async function deleteMember(
  db: Database,
  actingUserId: string,
  brandId: string,
  userId: string,
) {
  // Ensure acting user is owner and prevent removing last owner
  const actingOwner = await db
    .select({ role: brandMembers.role })
    .from(brandMembers)
    .where(
      and(
        eq(brandMembers.brandId, brandId),
        eq(brandMembers.userId, actingUserId),
        eq(brandMembers.role, "owner"),
      ),
    );
  if (!actingOwner.length) throw new BrandMemberForbiddenError();

  const target = await db
    .select({ role: brandMembers.role })
    .from(brandMembers)
    .where(
      and(eq(brandMembers.brandId, brandId), eq(brandMembers.userId, userId)),
    )
    .limit(1);
  const targetRole = target[0]?.role;
  if (targetRole === "owner") {
    const owners = await db
      .select({ id: brandMembers.id })
      .from(brandMembers)
      .where(
        and(eq(brandMembers.brandId, brandId), eq(brandMembers.role, "owner")),
      );
    if (owners.length <= 1) throw new BrandMemberSoleOwnerError();
  }

  await db
    .delete(brandMembers)
    .where(
      and(eq(brandMembers.brandId, brandId), eq(brandMembers.userId, userId)),
    );
  return { success: true } as const;
}
