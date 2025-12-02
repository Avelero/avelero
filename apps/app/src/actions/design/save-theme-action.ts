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

    // Try to upload CSS to Supabase storage (non-blocking - we still save to DB even if this fails)
    let stylesheetUploaded = false;
    if (stylesheetContent) {
      try {
        const file = new Blob([stylesheetContent], { type: "text/css" });
        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(stylesheetPath, file, {
            upsert: true,
            contentType: "text/css",
          });

        if (uploadError) {
          console.warn(
            `[save-theme] Storage upload warning: ${uploadError.message}`,
          );
        } else {
          stylesheetUploaded = true;
        }
      } catch (storageError) {
        // Log but don't fail - the DB save is more important
        console.warn(
          `[save-theme] Storage upload failed (bucket may not exist): ${storageError}`,
        );
      }
    }

    // Persist JSON + derived paths into brand_theme
    const { error: dbError } = await supabase
      .from("brand_theme")
      .upsert({
        brand_id: brandId,
        theme_styles: themeStyles ?? {},
        theme_config: themeConfig ?? {},
        // Only set stylesheet_path if upload succeeded
        stylesheet_path: stylesheetUploaded ? stylesheetPath : null,
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
      stylesheetPath: stylesheetUploaded ? stylesheetPath : null,
      googleFontsUrl,
      updatedAt: now,
    };
  });
