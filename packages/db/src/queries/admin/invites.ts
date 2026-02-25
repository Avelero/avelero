import { eq } from "drizzle-orm";
import type { Database } from "../../client";
import { brandInvites } from "../../schema";

export class AdminInviteNotFoundError extends Error {
  constructor() {
    super("INVITE_NOT_FOUND");
    this.name = "AdminInviteNotFoundError";
  }
}

export async function revokeBrandInviteByAdmin(
  db: Database,
  inviteId: string,
): Promise<{
  id: string;
  brandId: string;
  email: string;
  role: "owner" | "member";
}> {
  const [invite] = await db
    .select({
      id: brandInvites.id,
      brandId: brandInvites.brandId,
      email: brandInvites.email,
      role: brandInvites.role,
    })
    .from(brandInvites)
    .where(eq(brandInvites.id, inviteId))
    .limit(1);

  if (!invite) {
    throw new AdminInviteNotFoundError();
  }

  await db.delete(brandInvites).where(eq(brandInvites.id, inviteId));

  return {
    id: invite.id,
    brandId: invite.brandId,
    email: invite.email,
    role: invite.role === "owner" ? "owner" : "member",
  };
}
