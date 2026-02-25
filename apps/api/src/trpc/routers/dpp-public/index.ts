import { getBrandBySlug, getBrandTheme } from "@v1/db/queries";
import { getPublicDppByUpid } from "@v1/db/queries/dpp";
import {
  brandCustomDomains,
  brands,
  productPassports,
} from "@v1/db/schema";
import { getPublicUrl } from "@v1/supabase/storage";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
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
import { resolveThemeConfigImageUrls } from "../../../utils/theme-config-images.js";
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

  /**
   * Resolve a custom domain to its brand.
   *
   * Used by the DPP proxy to identify which brand owns a custom domain.
   * Returns domain info with verification status, allowing caller to decide
   * how to handle unverified domains.
   *
   * @param domain - The custom domain hostname (e.g., "passport.nike.com")
   * @returns Brand info with isVerified flag, or null if domain not found
   */
  resolveDomain: publicProcedure
    .input(
      z.object({
        domain: z.string().min(1).max(255),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [result] = await ctx.db
        .select({
          brandId: brandCustomDomains.brandId,
          brandSlug: brands.slug,
          domain: brandCustomDomains.domain,
          status: brandCustomDomains.status,
        })
        .from(brandCustomDomains)
        .innerJoin(brands, eq(brands.id, brandCustomDomains.brandId))
        .where(eq(brandCustomDomains.domain, input.domain.toLowerCase()))
        .limit(1);

      if (!result) {
        return null;
      }

      return {
        brandId: result.brandId,
        brandSlug: result.brandSlug,
        domain: result.domain,
        isVerified: result.status === "verified",
      };
    }),

  /**
   * Fetch DPP data by barcode within a specific brand.
   * URL: /barcode/{barcode} (on custom domains only)
   *
   * This endpoint is used for GS1 Digital Link resolution. It requires
   * a brand context (provided via custom domain) because barcodes are
   * only unique within a brand, not globally.
   *
   * @param brandId - The brand UUID (obtained from domain resolution)
   * @param barcode - The GTIN/barcode (8-14 digits)
   * @returns DPP snapshot data with theme, or null if not found/not published
   */
  getByBarcode: publicProcedure
    .input(
      z.object({
        brandId: z.string().uuid(),
        barcode: z
          .string()
          .min(8, "Barcode must be at least 8 digits")
          .max(14, "Barcode must be at most 14 digits")
          .regex(/^\d+$/, "Barcode must contain only digits"),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Normalize barcode to 14 digits for consistent lookup
      const normalizedBarcode = input.barcode.padStart(14, "0");

      // Search for both original and normalized versions
      const barcodes = [input.barcode];
      if (normalizedBarcode !== input.barcode) {
        barcodes.push(normalizedBarcode);
      }

      // Find the passport by barcode within this brand
      const [passport] = await ctx.db
        .select({
          upid: productPassports.upid,
        })
        .from(productPassports)
        .where(
          and(
            eq(productPassports.brandId, input.brandId),
            inArray(productPassports.barcode, barcodes),
            isNotNull(productPassports.currentVersionId),
          ),
        )
        .limit(1);

      if (!passport) {
        return null;
      }

      // Delegate to existing getPublicDppByUpid for full data retrieval
      const result = await getPublicDppByUpid(ctx.db, passport.upid);

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

      // Return same structure as getByPassportUpid
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
