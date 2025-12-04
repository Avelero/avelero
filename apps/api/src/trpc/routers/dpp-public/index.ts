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
} from "@v1/db/queries";
import { getPublicUrl } from "@v1/supabase/utils/storage-urls";
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

      // Resolve stylesheet URL server-side (DPP app doesn't need Supabase credentials)
      const stylesheetUrl = rawData.stylesheetPath
        ? getPublicUrl(ctx.supabase, "dpp-themes", rawData.stylesheetPath)
        : null;

      // Return all data needed for rendering
      return {
        dppData,
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

      // Resolve stylesheet URL server-side (DPP app doesn't need Supabase credentials)
      const stylesheetUrl = rawData.stylesheetPath
        ? getPublicUrl(ctx.supabase, "dpp-themes", rawData.stylesheetPath)
        : null;

      // Return all data needed for rendering
      return {
        dppData,
        themeConfig: rawData.themeConfig,
        themeStyles: rawData.themeStyles,
        stylesheetUrl,
        googleFontsUrl: rawData.googleFontsUrl,
      };
    }),
});

export type DppPublicRouter = typeof dppPublicRouter;

