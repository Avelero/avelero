"use server";

import { authActionClient } from "@/actions/safe-action";
import {
  buildThemeStylesheet,
  generateGoogleFontsUrlFromTypography,
  type ThemeStyles,
} from "@v1/dpp-components";
import { logger } from "@v1/logger";
import { tasks } from "@trigger.dev/sdk/v3";
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

    logger.info("[save-theme] Starting save", { brandId });

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
      logger.info("[save-theme] Uploading stylesheet to storage", {
        stylesheetPath,
        contentLength: stylesheetContent.length,
      });

      try {
        const file = new Blob([stylesheetContent], { type: "text/css" });
        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(stylesheetPath, file, {
            upsert: true,
            contentType: "text/css",
          });

        if (uploadError) {
          logger.error("[save-theme] Storage upload returned error", {
            error: uploadError.message,
          });
          throw new Error(
            `Failed to upload theme stylesheet: ${uploadError.message}`,
          );
        }

        logger.info("[save-theme] Storage upload successful");
      } catch (error) {
        logger.error("[save-theme] Storage upload threw exception", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
      }
    }

    // Update theme_styles in brand_theme table (preserves theme_config)
    logger.info("[save-theme] Updating database");

    try {
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
        logger.error("[save-theme] Database update returned error", {
          error: dbError.message,
        });
        throw new Error(
          dbError.message || "Unable to save theme styles for brand",
        );
      }

      logger.info("[save-theme] Database update successful");
    } catch (error) {
      logger.error("[save-theme] Database update threw exception", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }

    // Trigger screenshot capture in background (fire-and-forget)
    // Wrapped in try-catch so screenshot failures don't affect the save
    try {
      logger.info("[save-theme] Triggering screenshot capture");
      await tasks.trigger("capture-theme-screenshot", { brandId });
      logger.info("[save-theme] Screenshot trigger successful");
    } catch (error) {
      logger.warn("[save-theme] Failed to trigger screenshot capture", {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - screenshot is optional enhancement
    }

    logger.info("[save-theme] Save completed successfully");

    return {
      brandId,
      stylesheetPath,
      googleFontsUrl,
      updatedAt: now,
    };
  });
