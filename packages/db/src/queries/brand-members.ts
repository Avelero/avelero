import { and, asc, eq, inArray } from "drizzle-orm";
import type { Database } from "../client";
import { brandMembers, users } from "../schema";

export async function getMembersByBrandId(db: Database, brandId: string) {
  const rows = await db
    .select({
      userId: brandMembers.userId,
      role: brandMembers.role,
      createdAt: brandMembers.createdAt,
    })
    .from(brandMembers)
    .where(eq(brandMembers.brandId, brandId))
    .orderBy(asc(brandMembers.createdAt));

  // Join users separately to keep it simple without relations()
  const userIds = rows.map((r) => r.userId);
  const usersRows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      avatarPath: users.avatarPath,
      avatarHue: users.avatarHue,
    })
    .from(users)
    .where(inArray(users.id, userIds));
  const userById = new Map(usersRows.map((u) => [u.id, u]));

  return rows.map((row) => ({
    id: row.userId,
    role: row.role,
    teamId: brandId,
    created_at: row.createdAt,
    user: userById.get(row.userId) ?? null,
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
  if (!actingOwner.length) throw new Error("FORBIDDEN");

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
    if (owners.length <= 1) throw new Error("SOLE_OWNER");
  }

  await db
    .delete(brandMembers)
    .where(
      and(eq(brandMembers.brandId, brandId), eq(brandMembers.userId, userId)),
    );
  return { success: true } as const;
}
