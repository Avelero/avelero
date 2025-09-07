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
// acceptInviteForUser is imported from queries/brands.ts above

export const brandRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { db, user } = ctx;
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
    const data = await listBrandsForUser(db, user.id);
    return { data } as const;
  }),

  create: protectedProcedure
    .input(createBrandSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;
      if (!user) throw new Error("Unauthorized");

      return qCreateBrand(db, user.id, input);
    }),

  update: protectedProcedure
    .input(updateBrandSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      return qUpdateBrand(db, user.id, input);
    }),

  delete: protectedProcedure
    .input(idParamSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;
      return qDeleteBrand(db, input.id, user?.id as string);
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

      return sendBrandInvite(db, {
        brandId: input.brand_id,
        invites: [{ email: input.email, role: input.role, createdBy: user.id }],
      });
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
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
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
    .input(updateMemberSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user, brandId } = ctx;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
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
