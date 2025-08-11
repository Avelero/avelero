import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init.js";

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
});


