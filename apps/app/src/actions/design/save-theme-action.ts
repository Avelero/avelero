"use server";

/**
 * Persist the brand passport draft from the theme editor.
 */

import { authActionClient } from "@/actions/safe-action";
import { revalidateBrand } from "@v1/api/src/lib/dpp-revalidation";
import { normalizePassportImagePathsForStorage } from "@v1/api/src/utils/theme-config-images";
import type { Passport } from "@v1/dpp-components";
import type { Json } from "@v1/supabase/types";
import { z } from "zod";

const schema = z.object({
  brandId: z.string().uuid(),
  passport: z.custom<Passport>(),
});

export const saveThemeAction = authActionClient
  .schema(schema)
  .metadata({ name: "design.save-theme" })
  .action(async ({ parsedInput, ctx }) => {
    const { brandId, passport } = parsedInput;
    const supabase = ctx.supabase;
    const now = new Date().toISOString();

    // Normalize image URLs to storage paths before persisting
    const normalizedPassport = normalizePassportImagePathsForStorage(
      passport as unknown as Record<string, unknown>,
    );

    // Update passport in brand_theme table
    const { error: dbError } = await supabase
      .from("brand_theme")
      .update({
        passport: normalizedPassport as unknown as Json,
        updated_at: now,
      })
      .eq("brand_id", brandId);

    if (dbError) {
      throw new Error(dbError.message || "Unable to save passport for brand");
    }

    // Revalidate public DPP pages after the editor saves a new passport.
    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("slug")
      .eq("id", brandId)
      .single();

    if (brandError) {
      throw new Error(brandError.message || "Unable to load brand slug");
    }

    if (!brand?.slug) {
      throw new Error("Unable to revalidate brand without a slug");
    }

    await revalidateBrand(brand.slug);

    return {
      brandId,
      updatedAt: now,
    };
  });
