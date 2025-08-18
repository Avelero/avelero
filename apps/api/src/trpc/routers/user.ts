import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init.js";

export const userRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx;
    if (!user) return null;
    const { data, error } = await supabase
      .from("users")
      .select("id, email, full_name, avatar_path, avatar_hue, brand_id")
      .eq("id", user.id)
      .single();
    if (error) throw error;
    return data;
  }),

  update: protectedProcedure
    .input(
      z.object({
        full_name: z.string().optional(),
        avatar_url: z.string().url().optional(),  // legacy (ignored if column dropped)
        avatar_path: z.string().optional(),       // new: "<uid>/<file>"
        avatar_hue: z.number().int().min(1).max(359).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx;
      if (!user) throw new Error("Unauthorized");
      const { error } = await supabase
        .from("users")
        .update(input)
        .eq("id", user.id);
      if (error) throw error;
      return { success: true } as const;
    }),

  delete: protectedProcedure.mutation(async ({ ctx }) => {
    const { supabaseAdmin, user } = ctx;
    if (!user) throw new Error("Unauthorized");
    // delete profile row first (will cascade if FK configured)
    // Use admin API to delete auth user
    if (!supabaseAdmin) throw new Error("Service key not configured");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return { success: true } as const;
  }),
});


