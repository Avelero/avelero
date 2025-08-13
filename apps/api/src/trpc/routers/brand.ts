import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init.js";
import crypto from "node:crypto";
import { TRPCError } from "@trpc/server";
import { tasks } from "@trigger.dev/sdk/v3";

export const brandRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { supabase } = ctx;
    const { data, error } = await supabase
      .from("brands")
      .select("id, name, logo_url, country_code")
      .order("name", { ascending: true });
    if (error) throw error;
    return { data } as const;
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        country_code: z.string().optional().nullable(),
        logo_url: z.string().url().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx;
      if (!user) throw new Error("Unauthorized");

      const { data: brand, error: brandError } = await supabase
        .from("brands")
        .insert({
          name: input.name,
          country_code: input.country_code ?? null,
          logo_url: input.logo_url ?? null,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (brandError) throw brandError;
      if (!brand) throw new Error("Failed to create brand");

      const { error: membershipError } = await supabase
        .from("users_on_brand")
        .insert({ user_id: user.id, brand_id: brand.id, role: "owner" });
      if (membershipError) throw membershipError;

      const { error: userError } = await supabase
        .from("users")
        .update({ brand_id: brand.id })
        .eq("id", user.id);
      if (userError) throw userError;

      return { id: brand.id } as const;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { supabase } = ctx;
      // RLS ensures only owner can delete
      const { error } = await supabase.from("brands").delete().eq("id", input.id);
      if (error) throw error;
      return { success: true } as const;
    }),

  setActive: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx;
      if (!user) throw new Error("Unauthorized");

      // ensure membership exists
      const { count, error: countError } = await supabase
        .from("users_on_brand")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("brand_id", input.id);
      if (countError) throw countError;
      if (!count) throw new Error("Not a member of this brand");

      const { error } = await supabase
        .from("users")
        .update({ brand_id: input.id })
        .eq("id", user.id);
      if (error) throw error;
      return { success: true } as const;
    }),

  // Invites
  sendInvite: protectedProcedure
    .input(
      z.object({
        brand_id: z.string().uuid(),
        email: z.string().email(),
        role: z.enum(["owner", "member"]).default("member"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { supabase, supabaseAdmin, user } = ctx;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (!supabaseAdmin) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Admin client not configured" });

      // Ensure caller is an owner of the brand
      const { count: ownerCount, error: ownerErr } = await supabase
        .from("users_on_brand")
        .select("*", { count: "exact", head: true })
        .eq("brand_id", input.brand_id)
        .eq("user_id", user.id)
        .eq("role", "owner");
      if (ownerErr) throw ownerErr;
      if (!ownerCount) throw new TRPCError({ code: "FORBIDDEN", message: "Only brand owners can invite" });

      const appUrl = process.env.APP_URL as string | undefined;
      if (!appUrl) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "APP_URL missing" });

      // Generate Supabase invite link
      const { data: linkData, error: linkErr } = await (supabaseAdmin as any).auth.admin.generateLink({
        type: "invite",
        email: input.email,
        options: {
          redirectTo: `${appUrl}/api/auth/accept`,
        },
      });
      if (linkErr) throw linkErr;

      // Extract raw token from action_link
      const actionLink: string | undefined = linkData?.properties?.action_link ?? linkData?.action_link;
      if (!actionLink) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create invite link" });
      const url = new URL(actionLink);
      const rawToken = url.searchParams.get("token") ?? url.searchParams.get("token_hash");
      if (!rawToken) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Invite token missing" });

      // Hash token
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      // Optional: set expiry (7 days)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Insert invite row
      const { error: insertErr } = await supabase.from("brand_invites").insert({
        brand_id: input.brand_id,
        email: input.email,
        role: input.role,
        token_hash: tokenHash,
        status: "pending",
        expires_at: expiresAt,
        created_by: user.id,
      });
      if (insertErr) throw insertErr;

      // Fetch brand name for email content
      const { data: brandRow } = await supabase
        .from("brands")
        .select("name")
        .eq("id", input.brand_id)
        .single();

      // Prepare accept URL using token_hash (avoid raw token)
      const acceptUrl = `${appUrl}/api/auth/accept?token_hash=${tokenHash}`;

      // Trigger background email via Trigger.dev
      await tasks.trigger("invite-brand-members", {
        invites: [
          {
            recipientEmail: input.email,
            brandName: brandRow?.name ?? "Avelero",
            role: input.role,
            acceptUrl,
            expiresAt,
            appName: "Avelero",
          },
        ],
      });

      // Return minimal response
      return { success: true } as const;
    }),

  revokeInvite: protectedProcedure
    .input(z.object({ invite_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Find invite and ensure caller owns the brand
      const { data: invite, error: invErr } = await supabase
        .from("brand_invites")
        .select("id, brand_id, status")
        .eq("id", input.invite_id)
        .single();
      if (invErr) throw invErr;
      if (!invite) throw new TRPCError({ code: "NOT_FOUND" });

      const { count: ownerCount, error: ownerErr } = await supabase
        .from("users_on_brand")
        .select("*", { count: "exact", head: true })
        .eq("brand_id", invite.brand_id)
        .eq("user_id", user.id)
        .eq("role", "owner");
      if (ownerErr) throw ownerErr;
      if (!ownerCount) throw new TRPCError({ code: "FORBIDDEN" });

      const { error: updErr } = await supabase
        .from("brand_invites")
        .update({ status: "revoked" })
        .eq("id", input.invite_id);
      if (updErr) throw updErr;
      return { success: true } as const;
    }),

  listInvites: protectedProcedure
    .input(z.object({ brand_id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { supabase, user } = ctx;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Ensure membership
      const { count, error: countErr } = await supabase
        .from("users_on_brand")
        .select("*", { count: "exact", head: true })
        .eq("brand_id", input.brand_id)
        .eq("user_id", user.id);
      if (countErr) throw countErr;
      if (!count) throw new TRPCError({ code: "FORBIDDEN" });

      const { data, error } = await supabase
        .from("brand_invites")
        .select("id, email, role, status, accepted_at, fulfilled_at, expires_at, created_at")
        .eq("brand_id", input.brand_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return { data } as const;
    }),

  members: protectedProcedure
    .query(async ({ ctx }) => {
      const { supabase, brandId } = ctx;
      if (!brandId) throw new TRPCError({ code: "BAD_REQUEST", message: "No active brand" });

      const { data, error } = await supabase
        .from("users_on_brand")
        .select(
          "user_id, role, users:users(id, email, full_name, avatar_url)"
        )
        .eq("brand_id", brandId);
      if (error) throw error;

      const rows = (data ?? []).map((row: any) => ({
        id: row.user_id as string,
        role: (row.role as string) ?? null,
        teamId: brandId,
        user: {
          id: row.users?.id ?? null,
          email: row.users?.email ?? null,
          fullName: row.users?.full_name ?? null,
          avatarUrl: row.users?.avatar_url ?? null,
        },
      }));

      return rows;
    }),
});


