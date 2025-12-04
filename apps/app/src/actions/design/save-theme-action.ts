"use server";

import { authActionClient } from "@/actions/safe-action";
import {
  buildThemeStylesheet,
  generateGoogleFontsUrlFromTypography,
  type ThemeStyles,
} from "@v1/dpp-components";
import type { Json } from "@v1/supabase/types";
import { z } from "zod";

const BUCKET_NAME = "dpp-themes";

const schema = z.object({
  brandId: z.string().uuid(),
  themeStyles: z.custom<ThemeStyles>(),
});

export const saveThemeAction = authActionClient
  .schema(schema)
  .metadata({ name: "design.save-theme" })
  .action(async ({ parsedInput, ctx }) => {
    const { brandId, themeStyles } = parsedInput;
    const supabase = ctx.supabase;

    // Generate Google Fonts URL from typography settings
    const googleFontsUrl = generateGoogleFontsUrlFromTypography(
      themeStyles?.typography,
    );

    // Build CSS stylesheet from theme styles
    const stylesheetContent = buildThemeStylesheet({
      themeStyles,
      includeFontFaces: true,
    });

    const stylesheetPath = `brand-${brandId}/theme.css`;
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

    // Update theme_styles in brand_theme table (preserves theme_config)
    const { error: dbError } = await supabase
      .from("brand_theme")
      .update({
        theme_styles: themeStyles as unknown as Json,
        stylesheet_path: stylesheetPath,
        google_fonts_url: googleFontsUrl || null,
        updated_at: now,
      })
      .eq("brand_id", brandId);

    if (dbError) {
      throw new Error(
        dbError.message || "Unable to save theme styles for brand",
      );
    }

    return {
      brandId,
      stylesheetPath,
      googleFontsUrl,
      updatedAt: now,
    };
  });
