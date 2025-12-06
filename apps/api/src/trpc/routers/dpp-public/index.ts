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
import { createTRPCRouter, publicProcedure } from "../../init.js";
import {
  getDppByProductUpid,
  getDppByVariantUpid,
  transformToDppData,
  getBrandBySlug,
  getBrandTheme,
} from "@v1/db/queries";
import { getPublicUrl } from "@v1/supabase/storage";
import { slugSchema } from "../../../schemas/_shared/primitives.js";

/**
 * UPID schema: 16-character alphanumeric identifier
 */
const upidSchema = z
  .string()
  .length(16, "UPID must be 16 characters")
  .regex(/^[a-zA-Z0-9]+$/, "UPID must be alphanumeric");

/**
 * Input schema for product-level DPP fetch
 */
const getByProductUpidSchema = z.object({
  brandSlug: slugSchema,
  productUpid: upidSchema,
});

/**
 * Input schema for variant-level DPP fetch
 */
const getByVariantUpidSchema = z.object({
  brandSlug: slugSchema,
  productUpid: upidSchema,
  variantUpid: upidSchema,
});

/**
 * Input schema for theme preview fetch (screenshot generation)
 */
const getThemePreviewSchema = z.object({
  brandSlug: slugSchema,
});

export const dppPublicRouter = createTRPCRouter({
  /**
   * Fetch DPP data for a product-level passport.
   *
   * @param brandSlug - URL-friendly brand identifier
   * @param productUpid - 16-character product UPID
   * @returns DppData for rendering, or null if not found/not published
   */
  getByProductUpid: publicProcedure
    .input(getByProductUpidSchema)
    .query(async ({ ctx, input }) => {
      const { brandSlug, productUpid } = input;

      // Fetch using service-level database (bypasses RLS)
      const rawData = await getDppByProductUpid(ctx.db, brandSlug, productUpid);

      if (!rawData) {
        return null;
      }

      // Transform to component-ready format
      const dppData = transformToDppData(rawData);

      // Resolve URLs server-side (DPP app doesn't need Supabase credentials)
      const stylesheetUrl = rawData.stylesheetPath
        ? getPublicUrl(ctx.supabase, "dpp-themes", rawData.stylesheetPath)
        : null;

      // Resolve product image path to public URL
      const productImageUrl = rawData.productImage
        ? getPublicUrl(ctx.supabase, "products", rawData.productImage)
        : null;

      // Return all data needed for rendering
      return {
        dppData: {
          ...dppData,
          // Override productImage with resolved URL
          productImage: productImageUrl,
        },
        themeConfig: rawData.themeConfig,
        themeStyles: rawData.themeStyles,
        stylesheetUrl,
        googleFontsUrl: rawData.googleFontsUrl,
      };
    }),

  /**
   * Fetch DPP data for a variant-level passport.
   *
   * @param brandSlug - URL-friendly brand identifier
   * @param productUpid - 16-character product UPID
   * @param variantUpid - 16-character variant UPID
   * @returns DppData for rendering, or null if not found/not published
   */
  getByVariantUpid: publicProcedure
    .input(getByVariantUpidSchema)
    .query(async ({ ctx, input }) => {
      const { brandSlug, productUpid, variantUpid } = input;

      // Fetch using service-level database (bypasses RLS)
      const rawData = await getDppByVariantUpid(
        ctx.db,
        brandSlug,
        productUpid,
        variantUpid,
      );

      if (!rawData) {
        return null;
      }

      // Transform to component-ready format
      const dppData = transformToDppData(rawData);

      // Resolve URLs server-side (DPP app doesn't need Supabase credentials)
      const stylesheetUrl = rawData.stylesheetPath
        ? getPublicUrl(ctx.supabase, "dpp-themes", rawData.stylesheetPath)
        : null;

      // Resolve product image path to public URL
      const productImageUrl = rawData.productImage
        ? getPublicUrl(ctx.supabase, "products", rawData.productImage)
        : null;

      // Return all data needed for rendering
      return {
        dppData: {
          ...dppData,
          // Override productImage with resolved URL
          productImage: productImageUrl,
        },
        themeConfig: rawData.themeConfig,
        themeStyles: rawData.themeStyles,
        stylesheetUrl,
        googleFontsUrl: rawData.googleFontsUrl,
      };
    }),

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

      return {
        brandName: brand.name,
        themeConfig: theme?.themeConfig ?? null,
        themeStyles: theme?.themeStyles ?? null,
        stylesheetUrl,
        googleFontsUrl: theme?.googleFontsUrl ?? null,
      };
    }),
});

export type DppPublicRouter = typeof dppPublicRouter;

