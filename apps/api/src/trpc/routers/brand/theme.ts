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
import { getPublicUrl } from "@v1/supabase/storage";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { revalidateBrand } from "../../../lib/dpp-revalidation.js";
import { wrapError } from "../../../utils/errors.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";

// ============================================================================
// Helper: Resolve themeConfig image paths to full URLs
// ============================================================================

/**
 * Resolve image paths in themeConfig to full public URLs.
 *
 * ThemeConfig stores storage PATHS (not full URLs) for images.
 * This function converts those paths to full URLs using the current
 * environment's Supabase URL.
 */
function resolveThemeConfigImageUrls<T extends Record<string, unknown> | null>(
  supabase: SupabaseClient,
  themeConfig: T,
): T {
  if (!themeConfig) return themeConfig;

  // Deep clone to avoid mutating the original
  const resolved = JSON.parse(JSON.stringify(themeConfig)) as Record<
    string,
    unknown
  >;

  // Resolve branding.headerLogoUrl
  if (
    resolved.branding &&
    typeof resolved.branding === "object" &&
    resolved.branding !== null
  ) {
    const branding = resolved.branding as Record<string, unknown>;
    if (typeof branding.headerLogoUrl === "string" && branding.headerLogoUrl) {
      branding.headerLogoUrl = getPublicUrl(
        supabase,
        "dpp-assets",
        branding.headerLogoUrl,
      );
    }
  }

  // Resolve cta.bannerBackgroundImage
  if (
    resolved.cta &&
    typeof resolved.cta === "object" &&
    resolved.cta !== null
  ) {
    const cta = resolved.cta as Record<string, unknown>;
    if (
      typeof cta.bannerBackgroundImage === "string" &&
      cta.bannerBackgroundImage
    ) {
      cta.bannerBackgroundImage = getPublicUrl(
        supabase,
        "dpp-assets",
        cta.bannerBackgroundImage,
      );
    }
  }

  return resolved as T;
}

/**
 * Get theme data (styles and config) for the active brand.
 */
const getThemeProcedure = brandRequiredProcedure.query(async ({ ctx }) => {
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

export const brandThemeRouter = createTRPCRouter({
  get: getThemeProcedure,
  update: updateConfigProcedure,
});

export type BrandThemeRouter = typeof brandThemeRouter;
