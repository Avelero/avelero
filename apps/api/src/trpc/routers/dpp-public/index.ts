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
 *
 * Phase 6 changes:
 * - Added `carousel.list` endpoint for explicit carousel fetching
 */
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../../init.js";
import {
  getDppByProductUpid,
  getDppByVariantUpid,
  transformToDppData,
  getBrandBySlug,
  getBrandTheme,
  fetchCarouselProducts,
  getProductByUpid,
  type CarouselProduct,
} from "@v1/db/queries";
import { dppCarouselListSchema } from "../../../schemas/dpp-public.js";
import { getPublicUrl } from "@v1/supabase/storage";
import type { StorageClient } from "@v1/supabase/storage";
import { slugSchema } from "../../../schemas/_shared/primitives.js";

/**
 * Minimum number of products required to show the carousel.
 * If fewer products are available, the carousel is hidden.
 */
const MIN_CAROUSEL_PRODUCTS = 3;

/**
 * Minimal carousel config type (only what we need from ThemeConfig.carousel)
 */
interface CarouselConfig {
  productCount?: number;
  filter?: Record<string, unknown>;
  includeIds?: string[];
  excludeIds?: string[];
}

/**
 * Similar product for carousel display (matches DppData.similarProducts)
 */
interface SimilarProduct {
  image: string;
  name: string;
  price: number;
  currency?: string;
  url?: string;
}

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

/**
 * Transform carousel products from database format to SimilarProduct format.
 * Resolves image paths to public URLs.
 */
function transformCarouselProducts(
  products: CarouselProduct[],
  supabase: StorageClient,
): SimilarProduct[] {
  return products.map((product) => ({
    name: product.name,
    image: product.primaryImagePath
      ? (getPublicUrl(supabase, "products", product.primaryImagePath) ?? "")
      : "",
    price: Number(product.price),
    currency: product.currency,
    url: product.webshopUrl,
  }));
}

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

      // Fetch similar products for carousel
      const carouselConfig = (rawData.themeConfig as { carousel?: CarouselConfig } | null)
        ?.carousel;
      let similarProducts: SimilarProduct[] = [];

      if (carouselConfig) {
        const carouselProducts = await fetchCarouselProducts(ctx.db, {
          brandId: rawData.brandId,
          currentProductId: rawData.productId,
          currentCategoryId: rawData.categoryId,
          carouselConfig,
        });

        // Only include products if we have minimum required
        if (carouselProducts.length >= MIN_CAROUSEL_PRODUCTS) {
          similarProducts = transformCarouselProducts(
            carouselProducts,
            ctx.supabase,
          );
        }
      }

      // Return all data needed for rendering
      return {
        dppData: {
          ...dppData,
          // Override productIdentifiers.productImage with resolved URL
          productIdentifiers: {
            ...dppData.productIdentifiers,
            productImage: productImageUrl ?? "",
          },
        },
        dppContent: {
          similarProducts,
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

      // Fetch similar products for carousel
      // For variant-level DPP, exclude the parent product from carousel
      const carouselConfig = (rawData.themeConfig as { carousel?: CarouselConfig } | null)
        ?.carousel;
      let similarProducts: SimilarProduct[] = [];

      if (carouselConfig) {
        const carouselProducts = await fetchCarouselProducts(ctx.db, {
          brandId: rawData.brandId,
          currentProductId: rawData.productId, // Exclude the parent product
          currentCategoryId: rawData.categoryId,
          carouselConfig,
        });

        // Only include products if we have minimum required
        if (carouselProducts.length >= MIN_CAROUSEL_PRODUCTS) {
          similarProducts = transformCarouselProducts(
            carouselProducts,
            ctx.supabase,
          );
        }
      }

      // Return all data needed for rendering
      return {
        dppData: {
          ...dppData,
          // Override productIdentifiers.productImage with resolved URL
          productIdentifiers: {
            ...dppData.productIdentifiers,
            productImage: productImageUrl ?? "",
          },
        },
        dppContent: {
          similarProducts,
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

  /**
   * Carousel sub-router for explicit carousel product fetching.
   * Added in Phase 6.
   */
  carousel: createTRPCRouter({
    /**
     * Fetch carousel products for public DPP display.
     *
     * This is an explicit endpoint for fetching carousel products,
     * providing more control than the embedded carousel data in
     * getByProductUpid/getByVariantUpid responses.
     *
     * @param brandSlug - URL-friendly brand identifier
     * @param productUpid - Current product's UPID (to exclude from carousel)
     * @param limit - Maximum number of products to return (1-20, default 8)
     * @returns Array of carousel products, or empty array if insufficient products
     */
    list: publicProcedure
      .input(dppCarouselListSchema)
      .query(async ({ ctx, input }) => {
        const { brandSlug, productUpid, limit } = input;

        // Get brand by slug
        const brand = await getBrandBySlug(ctx.db, brandSlug);
        if (!brand) return [];

        // Get theme config for carousel settings
        const theme = await getBrandTheme(ctx.db, brand.id);
        const carouselConfig = (theme?.themeConfig as { carousel?: CarouselConfig } | null)?.carousel;

        if (!carouselConfig) return [];

        // Get product by UPID to exclude from carousel and get category
        const product = await getProductByUpid(ctx.db, brand.id, productUpid);
        if (!product) return [];

        // Fetch carousel products with limit override
        const products = await fetchCarouselProducts(ctx.db, {
          brandId: brand.id,
          currentProductId: product.id,
          currentCategoryId: product.category_id,
          carouselConfig: { ...carouselConfig, productCount: limit },
        });

        // Only return products if we have minimum required
        if (products.length < MIN_CAROUSEL_PRODUCTS) return [];

        return transformCarouselProducts(products, ctx.supabase);
      }),
  }),
});

export type DppPublicRouter = typeof dppPublicRouter;

