import { tasks } from "@trigger.dev/sdk/v3";
import { TRPCError } from "@trpc/server";
import {
  getMembersByBrandId,
  deleteMember as qDeleteMember,
  updateMemberRole as qUpdateMemberRole,
} from "@v1/db/queries";
import {
  getBrandsByUserId as listBrandsForUser,
  canLeaveBrand as qCanLeaveBrand,
  createBrand as qCreateBrand,
  deleteBrand as qDeleteBrand,
  leaveBrand as qLeaveBrand,
  setActiveBrand as qSetActiveBrand,
  updateBrand as qUpdateBrand,
} from "@v1/db/queries";
import {
  acceptBrandInvite as acceptInviteForRecipientById,
  listBrandInvites,
  listInvitesByEmail,
  declineBrandInvite as rejectInviteForRecipientById,
  revokeBrandInviteByOwner,
  createBrandInvites as sendBrandInvite,
} from "@v1/db/queries";
import { getAppUrl } from "@v1/utils/envs";
import { z } from "zod";
import {
  acceptInviteSchema,
  createBrandSchema,
  deleteMemberSchema,
  idParamSchema,
  listInvitesSchema,
  rejectInviteSchema,
  revokeInviteSchema,
  sendInviteSchema,
  updateBrandSchema,
  updateMemberSchema,
} from "../../schemas/brand.js";
import { createTRPCRouter, protectedProcedure } from "../init.js";
import { hasRole } from "../middleware/rbac.middleware.js";
import { type Permission } from "../../config/permissions.js";
import { ROLES } from "../../config/roles";
import type { User } from "@supabase/supabase-js";
// acceptInviteForUser is imported from queries/brands.ts above

export const brandRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { db, user } = ctx;
    // @ts-ignore
    const data = await listBrandsForUser(db, user.id);
    return { data } as const;
  }),

  create: protectedProcedure
    .input(createBrandSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;
      if (!user) throw new Error("Unauthorized");

      // Default email to user's email if not provided
      const brandData = {
        ...input,
        email: input.email ?? user.email,
      };

      return qCreateBrand(db, user.id, brandData);
    }),

  update: protectedProcedure
    .use(hasRole([ROLES.OWNER]))
    .input(updateBrandSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      return qUpdateBrand(db, user.id, input);
    }),

  delete: protectedProcedure
    .use(hasRole([ROLES.OWNER]))
    .input(idParamSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user, supabaseAdmin } = ctx;
      // Delete brand storage folder before deleting brand
      if (supabaseAdmin) {
        const { data: files } = await supabaseAdmin.storage
          .from("brand-avatars")
          .list(input.id);

        if (files && files.length > 0) {
          const filePaths = files.map((file) => `${input.id}/${file.name}`);
          await supabaseAdmin.storage.from("brand-avatars").remove(filePaths);
        }
      }

      // Delete brand and get next active brand
      const result = await qDeleteBrand(db, input.id, user.id);
      return result;
    }),

  setActive: protectedProcedure
    .input(idParamSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;
      if (!user) throw new Error("Unauthorized");
      return qSetActiveBrand(db, user.id, input.id);
    }),

  // Leave brand flow
  canLeave: protectedProcedure
    .input(idParamSchema)
    .query(async ({ ctx, input }) => {
      const { db, user } = ctx;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const res = await qCanLeaveBrand(db, user.id, input.id);
      return res;
    }),

  leave: protectedProcedure
    .input(idParamSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const res = await qLeaveBrand(db, user.id, input.id);
      if (!res.ok && res.code === "SOLE_OWNER") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "You are the sole owner of this brand. Promote another owner or delete the brand.",
        });
      }
      if (res.ok) {
        return { success: true, nextBrandId: res.nextBrandId } as const;
      }
      // Fallback safeguard (should never reach here due to checks above)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Unable to leave brand",
      });
    }),

  // Invites
  sendInvite: protectedProcedure
    .input(sendInviteSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const res = await sendBrandInvite(db, {
        brandId: input.brand_id,
        invites: [{ email: input.email, role: input.role, createdBy: user.id }],
      });

      type InviteResult = {
        email: string;
        role: typeof ROLES.OWNER | typeof ROLES.MEMBER;
        brand: { id: string | null; name: string | null } | null;
        tokenHash: string | null;
        isExistingUser: boolean;
      };

      const appUrl = getAppUrl();
      const results = (res.results as InviteResult[]) ?? [];
      if (results.length > 0) {
        const invites = results.map((r) => {
          const isExisting = r.isExistingUser;
          const acceptUrl = isExisting
            ? `${appUrl}/account/brands`
            : `${appUrl}/api/auth/accept?token_hash=${r.tokenHash ?? ""}`;
          return {
            recipientEmail: r.email,
            brandName: r.brand?.name ?? "Avelero",
            role: r.role,
            acceptUrl,
            ctaMode: isExisting ? ("view" as const) : ("accept" as const),
          };
        });
        try {
          await tasks.trigger("invite-brand-members", {
            invites,
            from: "Avelero <no-reply@welcome.avelero.com>",
          });
        } catch (e) {
          // Log and continue; API should still succeed even if email fails to enqueue
          console.error("Failed to enqueue invite emails", e);
        }
      }

      return res;
    }),

  revokeInvite: protectedProcedure
    .input(revokeInviteSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      return revokeBrandInviteByOwner(db, user.id, input.invite_id);
    }),

  listInvites: protectedProcedure
    .input(listInvitesSchema)
    .query(async ({ ctx, input }) => {
      const { db, user } = ctx;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      return listBrandInvites(db, user.id, input.brand_id);
    }),

  // Recipient view: list invites addressed to current user's email
  myInvites: protectedProcedure.query(async ({ ctx }) => {
    const { db, user } = ctx;
    // @ts-ignore
    const userEmail = user.email;
    if (!userEmail) throw new TRPCError({ code: "UNAUTHORIZED" });
    return listInvitesByEmail(db, userEmail);
  }),

  acceptInvite: protectedProcedure
    .input(acceptInviteSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const res = await acceptInviteForRecipientById(db, {
        id: input.id,
        userId: user.id,
      });
      return { success: true, brandId: res.brandId } as const;
    }),

  rejectInvite: protectedProcedure
    .input(rejectInviteSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const res = await rejectInviteForRecipientById(db, {
        id: input.id,
        email: user.email!,
      });
      return { success: true } as const;
    }),

  members: protectedProcedure.query(async ({ ctx }) => {
    const { db, brandId } = ctx;
    if (!brandId)
      throw new TRPCError({ code: "BAD_REQUEST", message: "No active brand" });
    return getMembersByBrandId(db, brandId);
  }),

  updateMember: protectedProcedure
    .use(hasRole([ROLES.OWNER]))
    .input(updateMemberSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user, brandId } = ctx;
      if (!brandId)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active brand",
        });
      await qUpdateMemberRole(db, user.id, brandId, input.user_id, input.role);
      return { success: true } as const;
    }),

  deleteMember: protectedProcedure
    .input(deleteMemberSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user, brandId } = ctx;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (!brandId)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active brand",
        });
      try {
        await qDeleteMember(db, user.id, brandId, input.user_id);
        return { success: true } as const;
      } catch (e) {
        if (e instanceof Error && e.message === "SOLE_OWNER") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "SOLE_OWNER" });
        }
        throw e;
      }
    }),
});
