import { listPendingInvitesForEmail } from "@v1/db/queries/brand";
import { sql } from "@v1/db/queries";
import { users } from "@v1/db/schema";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../../init.js";

const otpPreflightSchema = z.object({
  email: z.string().trim().email(),
});

export const authRouter = createTRPCRouter({
  otpPreflight: publicProcedure
    .input(otpPreflightSchema)
    .query(async ({ ctx, input }) => {
      const email = input.email.trim().toLowerCase();

      const [existingUser] = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(sql`LOWER(TRIM(BOTH FROM "users"."email")) = ${email}`)
        .limit(1);

      if (existingUser) {
        return {
          allowed: true,
          reason: "existing_account" as const,
        };
      }

      const pendingInvites = await listPendingInvitesForEmail(ctx.db, email);
      if (pendingInvites.length > 0) {
        return {
          allowed: true,
          reason: "pending_invite" as const,
        };
      }

      return {
        allowed: false,
        reason: "invite_required" as const,
      };
    }),
});

type AuthRouter = typeof authRouter;
