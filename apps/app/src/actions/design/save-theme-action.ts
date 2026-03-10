"use server";

import { authActionClient } from "@/actions/safe-action";
import {
  type Passport,
  buildPassportStylesheet,
  generateGoogleFontsUrlFromTypography,
} from "@v1/dpp-components";
import type { Json } from "@v1/supabase/types";
import { normalizePassportImagePathsForStorage } from "@v1/api/src/utils/theme-config-images";
import { z } from "zod";

const BUCKET_NAME = "dpp-themes";

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

    // Generate Google Fonts URL from typography settings
    const googleFontsUrl = generateGoogleFontsUrlFromTypography(
      passport?.tokens?.typography as Record<string, unknown> | undefined,
      passport?.tokens?.fonts,
    );

    // Build CSS stylesheet from passport tokens
    if (!passport?.tokens) {
      throw new Error("Invalid passport: missing tokens");
    }
    const stylesheetContent = buildPassportStylesheet(passport.tokens);

    const stylesheetPath = `${brandId}/theme.css`;
    const now = new Date().toISOString();

    // Upload CSS to Supabase storage
    if (stylesheetContent) {
      const file = new Blob([stylesheetContent], { type: "text/css" });
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(stylesheetPath, file, {
          upsert: true,
          contentType: "text/css",
        });

      if (uploadError) {
        throw new Error(
          `Failed to upload theme stylesheet: ${uploadError.message}`,
        );
      }
    }

    // Normalize image URLs to storage paths before persisting
    const normalizedPassport = normalizePassportImagePathsForStorage(
      passport as unknown as Record<string, unknown>,
    );

    // Update passport in brand_theme table
    const { error: dbError } = await supabase
      .from("brand_theme")
      .update({
        passport: normalizedPassport as unknown as Json,
        stylesheet_path: stylesheetPath,
        google_fonts_url: googleFontsUrl || null,
        updated_at: now,
      })
      .eq("brand_id", brandId);

    if (dbError) {
      throw new Error(dbError.message || "Unable to save passport for brand");
    }

    return {
      brandId,
      stylesheetPath,
      googleFontsUrl,
      updatedAt: now,
    };
  });
