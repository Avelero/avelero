import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getMembersByBrandId,
  deleteMember as qDeleteMember,
  updateMemberRole as qUpdateMemberRole,
} from "../../queries/brand-members.js";
import {
  listBrandsForUser,
  canLeaveBrand as qCanLeaveBrand,
  createBrand as qCreateBrand,
  deleteBrand as qDeleteBrand,
  leaveBrand as qLeaveBrand,
  setActiveBrand as qSetActiveBrand,
  updateBrand as qUpdateBrand,
} from "../../queries/brands.js";
import {
  acceptInviteForRecipientById,
  listBrandInvites,
  listInvitesByEmail,
  rejectInviteForRecipientById,
  revokeBrandInviteByOwner,
  sendBrandInvite,
} from "../../queries/invites.js";
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
    const { supabase, user } = ctx;
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
    const data = await listBrandsForUser(supabase, user.id);
    return { data } as const;
  }),

  create: protectedProcedure
    .input(createBrandSchema)
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx;
      if (!user) throw new Error("Unauthorized");
      return qCreateBrand(supabase, user.id, input);
    }),

  update: protectedProcedure
    .input(updateBrandSchema)
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      return qUpdateBrand(supabase, user.id, input);
    }),

  delete: protectedProcedure
    .input(idParamSchema)
    .mutation(async ({ ctx, input }) => {
      const { supabase } = ctx;
      return qDeleteBrand(supabase, input.id);
    }),

  setActive: protectedProcedure
    .input(idParamSchema)
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx;
      if (!user) throw new Error("Unauthorized");
      return qSetActiveBrand(supabase, user.id, input.id);
    }),

  // Leave brand flow
  canLeave: protectedProcedure
    .input(idParamSchema)
    .query(async ({ ctx, input }) => {
      const { supabase, user } = ctx;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const res = await qCanLeaveBrand(supabase, user.id, input.id);
      return res;
    }),

  leave: protectedProcedure
    .input(idParamSchema)
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const res = await qLeaveBrand(supabase, user.id, input.id);
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
      const { supabase, supabaseAdmin, user } = ctx;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      return sendBrandInvite(supabase, supabaseAdmin ?? null, {
        brand_id: input.brand_id,
        email: input.email,
        role: input.role,
        created_by: user.id,
      });
    }),

  revokeInvite: protectedProcedure
    .input(revokeInviteSchema)
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      return revokeBrandInviteByOwner(supabase, user.id, input.invite_id);
    }),

  listInvites: protectedProcedure
    .input(listInvitesSchema)
    .query(async ({ ctx, input }) => {
      const { supabase, user } = ctx;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      return listBrandInvites(supabase, user.id, input.brand_id);
    }),

  // Recipient view: list invites addressed to current user's email
  myInvites: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx;
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
    const userEmail = user.email;
    if (!userEmail) throw new TRPCError({ code: "UNAUTHORIZED" });
    return listInvitesByEmail(supabase, userEmail);
  }),

  acceptInvite: protectedProcedure
    .input(acceptInviteSchema)
    .mutation(async ({ ctx, input }) => {
      const { supabase, supabaseAdmin, user } = ctx;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const res = await acceptInviteForRecipientById(supabase, user, input.id);
      if (!res.ok)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${res.code}: ${res.message}`,
        });
      return { success: true, brandId: res.brandId } as const;
    }),

  rejectInvite: protectedProcedure
    .input(rejectInviteSchema)
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const res = await rejectInviteForRecipientById(supabase, user, input.id);
      if (!res.ok)
        throw new TRPCError({ code: "BAD_REQUEST", message: res.code });
      return { success: true } as const;
    }),

  members: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, brandId } = ctx;
    if (!brandId)
      throw new TRPCError({ code: "BAD_REQUEST", message: "No active brand" });
    return getMembersByBrandId(supabase, brandId);
  }),

  updateMember: protectedProcedure
    .input(updateMemberSchema)
    .mutation(async ({ ctx, input }) => {
      const { supabase, user, brandId } = ctx;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (!brandId)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active brand",
        });
      await qUpdateMemberRole(
        supabase,
        user.id,
        brandId,
        input.user_id,
        input.role,
      );
      return { success: true } as const;
    }),

  deleteMember: protectedProcedure
    .input(deleteMemberSchema)
    .mutation(async ({ ctx, input }) => {
      const { supabase, user, brandId } = ctx;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (!brandId)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active brand",
        });
      try {
        await qDeleteMember(supabase, user.id, brandId, input.user_id);
        return { success: true } as const;
      } catch (e) {
        if (e instanceof Error && e.message === "SOLE_OWNER") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "SOLE_OWNER" });
        }
        throw e;
      }
    }),
});
