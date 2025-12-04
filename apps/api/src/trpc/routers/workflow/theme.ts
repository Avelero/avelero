/**
 * Theme router for workflow domain.
 *
 * Handles theme configuration (content) and theme styles operations.
 * - workflow.theme.get - Get full theme (styles + config)
 * - workflow.theme.updateConfig - Update theme config (menus, banner, social, etc.)
 */
import {
  getBrandTheme,
  updateBrandThemeConfig,
  eq,
} from "@v1/db/queries";
import { brands } from "@v1/db/schema";
import { z } from "zod";
import { revalidateBrand } from "../../../lib/dpp-revalidation.js";
import { wrapError } from "../../../utils/errors.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";

/**
 * Get theme data (styles and config) for the active brand.
 */
const getThemeProcedure = brandRequiredProcedure.query(async ({ ctx }) => {
  const { db, brandId } = ctx;
  try {
    const theme = await getBrandTheme(db, brandId);
    if (!theme) {
      return {
        themeStyles: {},
        themeConfig: {},
        googleFontsUrl: null,
        updatedAt: null,
      };
    }
    return {
      themeStyles: theme.themeStyles,
      themeConfig: theme.themeConfig,
      googleFontsUrl: theme.googleFontsUrl,
      updatedAt: theme.updatedAt,
    };
  } catch (error) {
    throw wrapError(error, "Failed to fetch theme");
  }
});

/**
 * Update theme config (content) for the active brand.
 * This updates menus, banner, social links, section visibility, etc.
 */
const updateConfigProcedure = brandRequiredProcedure
  .input(
    z.object({
      // ThemeConfig is validated on the client side
      // Here we accept any object and store it as JSONB
      config: z.record(z.unknown()),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const { db, brandId } = ctx;
    try {
      const result = await updateBrandThemeConfig(db, brandId, input.config);

      // Revalidate all DPP pages for this brand (fire-and-forget)
      // Wrapped in try-catch so revalidation failures don't affect the response
      try {
        const [brand] = await db
          .select({ slug: brands.slug })
          .from(brands)
          .where(eq(brands.id, brandId))
          .limit(1);
        if (brand?.slug) {
          revalidateBrand(brand.slug).catch(() => {});
        }
      } catch {
        // Silently ignore revalidation errors - the config update already succeeded
      }

      return result;
    } catch (error) {
      throw wrapError(error, "Failed to update theme config");
    }
  });

export const workflowThemeRouter = createTRPCRouter({
  get: getThemeProcedure,
  updateConfig: updateConfigProcedure,
});

export type WorkflowThemeRouter = typeof workflowThemeRouter;

