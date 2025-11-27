"use server";

import { authActionClient } from "@/actions/safe-action";
import {
  buildThemeStylesheet,
  generateGoogleFontsUrlFromTypography,
  type ThemeConfig,
  type ThemeStyles,
} from "@v1/dpp-components";
import { createClient } from "@v1/supabase/server";
import { z } from "zod";

const BUCKET_NAME = "dpp-themes";

const schema = z.object({
  brandId: z.string().uuid(),
  themeStyles: z.custom<ThemeStyles>().optional(),
  themeConfig: z.custom<ThemeConfig>().optional(),
});

export const saveThemeAction = authActionClient
  .schema(schema)
  .metadata({ name: "design.save-theme" })
  .action(async ({ parsedInput, ctx }) => {
    const { brandId, themeStyles, themeConfig } = parsedInput;
    const supabase = ctx.supabase ?? (await createClient());

    // Compute derived artifacts
    const googleFontsUrl = generateGoogleFontsUrlFromTypography(
      themeStyles?.typography,
    );

    const stylesheetContent = buildThemeStylesheet({
      themeStyles,
      includeFontFaces: true,
    });

    const stylesheetPath = `brand-${brandId}/theme.css`;
    const now = new Date().toISOString();

    // Upload CSS overrides to Supabase storage (bucket must already exist)
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

    // Persist JSON + derived paths into brand_theme (new table)
    const { error: dbError } = await (supabase as any)
      .from("brand_theme")
      .upsert({
        brand_id: brandId,
        theme_styles: themeStyles ?? {},
        theme_config: themeConfig ?? {},
        stylesheet_path: stylesheetPath,
        google_fonts_url: googleFontsUrl || null,
        updated_at: now,
      });

    if (dbError) {
      throw new Error(
        dbError.message || "Unable to save theme configuration for brand",
      );
    }

    return {
      brandId,
      stylesheetPath,
      googleFontsUrl,
      updatedAt: now,
    };
  });
