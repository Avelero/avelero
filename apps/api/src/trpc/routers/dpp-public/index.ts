import { getBrandBySlug, getBrandTheme } from "@v1/db/queries";
import { getPublicDppByUpid } from "@v1/db/queries/dpp";
import { getPublicUrl } from "@v1/supabase/storage";
import type { SupabaseClient } from "@supabase/supabase-js";
/**
 * Public DPP (Digital Product Passport) router.
 *
 * Provides public endpoints for fetching DPP data. These endpoints do not
 * require authentication and are designed to be called by the DPP frontend app.
 *
 * Security:
 * - Uses service-level database access (bypasses RLS)
 * - Only returns published products
 * - Input validation on all parameters
 */
import { z } from "zod";

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
import { slugSchema } from "../../../schemas/_shared/primitives.js";
import { createTRPCRouter, publicProcedure } from "../../init.js";

/**
 * UPID schema: 16-character alphanumeric identifier
 */
const upidSchema = z
  .string()
  .length(16, "UPID must be 16 characters")
  .regex(/^[a-zA-Z0-9]+$/, "UPID must be alphanumeric");

/**
 * Input schema for theme preview fetch (screenshot generation)
 */
const getThemePreviewSchema = z.object({
  brandSlug: slugSchema,
});

export const dppPublicRouter = createTRPCRouter({
  /**
   * Fetch theme data for screenshot preview.
   *
   * Used by the /ahw_preview_jja/ route to render a brand's theme with demo data
   * for screenshot generation. Does not require any products to exist.
   *
   * @param brandSlug - URL-friendly brand identifier
   * @returns Theme data for rendering, or null if brand not found
   */
  getThemePreview: publicProcedure
    .input(getThemePreviewSchema)
    .query(async ({ ctx, input }) => {
      const { brandSlug } = input;

      // Get brand by slug
      const brand = await getBrandBySlug(ctx.db, brandSlug);

      if (!brand) {
        return null;
      }

      // Fetch brand theme
      const theme = await getBrandTheme(ctx.db, brand.id);

      // Resolve stylesheet URL if present
      const stylesheetUrl = theme?.stylesheetPath
        ? getPublicUrl(ctx.supabase, "dpp-themes", theme.stylesheetPath)
        : null;

      // Resolve image paths in themeConfig to full URLs
      const resolvedThemeConfig = resolveThemeConfigImageUrls(
        ctx.supabase,
        (theme?.themeConfig as Record<string, unknown>) ?? null,
      );

      return {
        brandName: brand.name,
        themeConfig: resolvedThemeConfig,
        themeStyles: theme?.themeStyles ?? null,
        stylesheetUrl,
        googleFontsUrl: theme?.googleFontsUrl ?? null,
      };
    }),

  /**
   * Fetch DPP data by passport UPID.
   * URL: /{upid}
   *
   * This endpoint reads from the immutable publishing layer (snapshots)
   * rather than the normalized working layer, providing faster and simpler
   * data access for published passports.
   *
   * @param upid - The Universal Product Identifier (16-char alphanumeric)
   * @returns DPP snapshot data with theme, or null if not found/not published
   */
  getByPassportUpid: publicProcedure
    .input(
      z.object({
        upid: upidSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      const { upid } = input;

      // Fetch from the immutable publishing layer
      const result = await getPublicDppByUpid(ctx.db, upid);

      if (!result.found || !result.snapshot) {
        return null;
      }

      // Resolve stylesheet URL if present
      const stylesheetUrl = result.theme?.stylesheetPath
        ? getPublicUrl(ctx.supabase, "dpp-themes", result.theme.stylesheetPath)
        : null;

      // Resolve product image in the snapshot to public URL
      let productImageUrl: string | null = null;
      const snapshotImage = result.snapshot.productAttributes?.image;
      if (snapshotImage && typeof snapshotImage === "string") {
        // Check if it's already a full URL or a storage path
        if (
          snapshotImage.startsWith("http://") ||
          snapshotImage.startsWith("https://")
        ) {
          productImageUrl = snapshotImage;
        } else {
          productImageUrl = getPublicUrl(
            ctx.supabase,
            "products",
            snapshotImage,
          );
        }
      }

      // Resolve image paths in themeConfig to full URLs
      const resolvedThemeConfig = resolveThemeConfigImageUrls(
        ctx.supabase,
        (result.theme?.config as Record<string, unknown>) ?? null,
      );

      // Return the snapshot data with theme information
      return {
        dppData: {
          ...result.snapshot,
          productAttributes: {
            ...result.snapshot.productAttributes,
            image: productImageUrl ?? "",
          },
        },
        themeConfig: resolvedThemeConfig,
        themeStyles: result.theme?.styles ?? null,
        stylesheetUrl,
        googleFontsUrl: result.theme?.googleFontsUrl ?? null,
        passport: {
          upid: result.upid,
          isInactive: result.isInactive,
          version: result.version,
        },
      };
    }),
});

type DppPublicRouter = typeof dppPublicRouter;
