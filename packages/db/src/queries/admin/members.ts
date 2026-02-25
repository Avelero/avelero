import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";
import type { Database } from "../../client";
import { brandMembers, brands, users } from "../../schema";
import { AdminBrandNotFoundError, assertAdminBrandExists } from "./brands";

export class AdminUserNotFoundError extends Error {
  constructor() {
    super("USER_NOT_FOUND");
    this.name = "AdminUserNotFoundError";
  }
}

export class AdminMemberAlreadyExistsError extends Error {
  constructor() {
    super("ALREADY_MEMBER");
    this.name = "AdminMemberAlreadyExistsError";
  }
}

export class AdminMemberNotFoundError extends Error {
  constructor() {
    super("MEMBER_NOT_FOUND");
    this.name = "AdminMemberNotFoundError";
  }
}

export class AdminSoleOwnerError extends Error {
  constructor() {
    super("SOLE_OWNER");
    this.name = "AdminSoleOwnerError";
  }
}

async function getUserByEmailCaseInsensitive(db: Database, email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
    })
    .from(users)
    .where(sql`lower(${users.email}) = ${normalizedEmail}`)
    .limit(1);

  return user ?? null;
}

export async function addBrandMemberByEmailAsAdmin(
  db: Database,
  input: {
    brandId: string;
    email: string;
    role: "owner" | "member";
  },
) {
  await assertAdminBrandExists(db, input.brandId);

  const user = await getUserByEmailCaseInsensitive(db, input.email);
  if (!user) {
    throw new AdminUserNotFoundError();
  }

  const [existingMembership] = await db
    .select({ id: brandMembers.id })
    .from(brandMembers)
    .where(
      and(
        eq(brandMembers.brandId, input.brandId),
        eq(brandMembers.userId, user.id),
      ),
    )
    .limit(1);

  if (existingMembership) {
    throw new AdminMemberAlreadyExistsError();
  }

  await db.insert(brandMembers).values({
    brandId: input.brandId,
    userId: user.id,
    role: input.role,
  });

  return {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    role: input.role,
  };
}

export async function removeBrandMemberAsAdmin(
  db: Database,
  input: {
    brandId: string;
    userId: string;
  },
): Promise<{ removedUserId: string; nextBrandId: string | null }> {
  return db.transaction(async (tx) => {
    const [brand] = await tx
      .select({ id: brands.id })
      .from(brands)
      .where(and(eq(brands.id, input.brandId), isNull(brands.deletedAt)))
      .limit(1);

    if (!brand) {
      throw new AdminBrandNotFoundError();
    }

    const [member] = await tx
      .select({
        role: brandMembers.role,
      })
      .from(brandMembers)
      .where(
        and(
          eq(brandMembers.brandId, input.brandId),
          eq(brandMembers.userId, input.userId),
        ),
      )
      .limit(1);

    if (!member) {
      throw new AdminMemberNotFoundError();
    }

    if (member.role === "owner") {
      const [ownersCountRow] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(brandMembers)
        .where(
          and(
            eq(brandMembers.brandId, input.brandId),
            eq(brandMembers.role, "owner"),
          ),
        );

      if ((ownersCountRow?.count ?? 0) <= 1) {
        throw new AdminSoleOwnerError();
      }
    }

    await tx
      .delete(brandMembers)
      .where(
        and(
          eq(brandMembers.brandId, input.brandId),
          eq(brandMembers.userId, input.userId),
        ),
      );

    const [currentUser] = await tx
      .select({ brandId: users.brandId })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);

    let nextBrandId = currentUser?.brandId ?? null;

    if (nextBrandId === input.brandId) {
      const [nextMembership] = await tx
        .select({ brandId: brandMembers.brandId })
        .from(brandMembers)
        .innerJoin(brands, eq(brandMembers.brandId, brands.id))
        .where(
          and(
            eq(brandMembers.userId, input.userId),
            ne(brandMembers.brandId, input.brandId),
            isNull(brands.deletedAt),
          ),
        )
        .orderBy(asc(brands.name))
        .limit(1);

      nextBrandId = nextMembership?.brandId ?? null;

      await tx
        .update(users)
        .set({ brandId: nextBrandId })
        .where(eq(users.id, input.userId));
    }

    return {
      removedUserId: input.userId,
      nextBrandId,
    };
  });
}
