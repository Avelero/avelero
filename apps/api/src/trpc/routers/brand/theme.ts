import { eq } from "@v1/db/queries";
/**
 * Brand theme router.
 *
 * Handles theme configuration (content) and theme styles operations.
 *
 * Phase 4 changes:
 * - Renamed from workflowThemeRouter to brandThemeRouter
 * - Removed listCarouselProducts (use products.list instead)
 *
 * Targets:
 * - brand.theme.get - Get full theme (styles + config)
 * - brand.theme.update - Update theme config (menus, banner, social, etc.)
 */
import { getBrandTheme, updateBrandThemeConfig } from "@v1/db/queries/brand";
import { brands } from "@v1/db/schema";
import { z } from "zod";
import { revalidateBrand } from "../../../lib/dpp-revalidation.js";
import { wrapError } from "../../../utils/errors.js";
import {
  normalizeThemeConfigImagePathsForStorage,
  resolveThemeConfigImageUrls,
} from "../../../utils/theme-config-images.js";
import {
  brandReadProcedure,
  brandWriteProcedure,
  createTRPCRouter,
} from "../../init.js";

/**
 * Get theme data (styles and config) for the active brand.
 */
const getThemeProcedure = brandReadProcedure.query(async ({ ctx }) => {
  const { db, brandId, supabase } = ctx;
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

    // Resolve image paths in themeConfig to full URLs
    const resolvedThemeConfig = resolveThemeConfigImageUrls(
      supabase,
      (theme.themeConfig as Record<string, unknown>) ?? {},
    );

    return {
      themeStyles: theme.themeStyles,
      themeConfig: resolvedThemeConfig,
      googleFontsUrl: theme.googleFontsUrl,
      updatedAt: theme.updatedAt,
    };
  } catch (error) {
    throw wrapError(error, "Failed to fetch theme");
  }
});

/**
 * Update theme config (content) for the active brand.
 * This updates menus, banner, social links, section visibility, carousel config, etc.
 */
const updateConfigProcedure = brandWriteProcedure
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
      const normalizedConfig = normalizeThemeConfigImagePathsForStorage(
        input.config,
      );
      const result = await updateBrandThemeConfig(
        db,
        brandId,
        normalizedConfig,
      );

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

export const brandThemeRouter = createTRPCRouter({
  get: getThemeProcedure,
  update: updateConfigProcedure,
});

type BrandThemeRouter = typeof brandThemeRouter;
