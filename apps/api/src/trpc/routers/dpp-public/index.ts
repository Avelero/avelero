import { getBrandBySlug, getBrandTheme } from "@v1/db/queries";
import { getPublicDppByUpid, getPublicPassportByBarcode } from "@v1/db/queries/dpp";
import { projectSinglePassport } from "@v1/db/queries/products";
import { brandCustomDomains, brands } from "@v1/db/schema";
import { getPublicUrl } from "@v1/supabase/storage";
import { eq } from "drizzle-orm";
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
import { slugSchema } from "../../../schemas/_shared/primitives.js";
import { internalServerError } from "../../../utils/errors.js";
import { resolvePassportImageUrls } from "../../../utils/theme-config-images.js";
import {
  type TRPCContext,
  createTRPCRouter,
  publicProcedure,
} from "../../init.js";

const PRODUCTS_BUCKET = "products";

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

/**
 * Escape regex metacharacters for a dynamic path pattern.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Decode URI path segments safely.
 */
function decodeStoragePath(path: string): string {
  return path
    .split("/")
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join("/");
}

/**
 * Extract a bucket object path from known Supabase storage URL shapes.
 */
function extractStorageObjectPath(
  value: string,
  bucket: string,
): string | null {
  const escapedBucket = escapeRegExp(bucket);
  const pattern = new RegExp(
    `(?:https?:\\/\\/[^/]+)?\\/storage\\/v1\\/object\\/(?:public|sign)\\/${escapedBucket}\\/(.+?)(?:[?#].*)?$`,
    "i",
  );
  const match = value.match(pattern);
  if (!match?.[1]) return null;
  return decodeStoragePath(match[1]);
}

/**
 * Resolve snapshot image values to a current public URL on the configured storage domain.
 */
function resolveSnapshotProductImageUrl(
  storageClient: Parameters<typeof getPublicUrl>[0],
  imageValue: string | null | undefined,
): string | null {
  if (!imageValue) return null;

  const normalizedImage =
    extractStorageObjectPath(imageValue, PRODUCTS_BUCKET) ?? imageValue;
  if (
    normalizedImage.startsWith("http://") ||
    normalizedImage.startsWith("https://")
  ) {
    return normalizedImage;
  }

  return (
    getPublicUrl(storageClient, PRODUCTS_BUCKET, normalizedImage) ??
    normalizedImage
  );
}

/**
 * Format a public passport query result into the router response shape.
 */
function buildPublicPassportResponse(
  storageClient: TRPCContext["supabase"],
  result: Awaited<ReturnType<typeof getPublicDppByUpid>>,
) {
  // The router only calls this helper once a materialized snapshot exists.
  if (!result.snapshot) {
    return null;
  }

  const productImageUrl = resolveSnapshotProductImageUrl(
    storageClient,
    result.snapshot.productAttributes?.image,
  );
  const resolvedBrandPassport = resolvePassportImageUrls(
    storageClient,
    (result.theme?.passport as Record<string, unknown>) ?? null,
  );

  return {
    dppData: {
      ...result.snapshot,
      productAttributes: {
        ...result.snapshot.productAttributes,
        image: productImageUrl ?? "",
      },
    },
    brandPassport: resolvedBrandPassport,
    passport: {
      upid: result.upid,
      isInactive: false,
      version: result.version,
    },
  };
}

/**
 * Load a public passport, projecting inline when the working snapshot is dirty.
 */
async function resolvePublicPassportResponse(
  ctx: Pick<TRPCContext, "db" | "supabase">,
  upid: string,
) {
  // Start from the publishing-layer read model so both public endpoints share the same logic.
  let result = await getPublicDppByUpid(ctx.db, upid);

  if (!result.found || !result.passport) {
    return null;
  }

  if (result.productStatus !== "published") {
    return null;
  }

  if (result.passport.dirty) {
    const projection = await projectSinglePassport(ctx.db, result.passport.id);

    if (projection.error) {
      console.error(
        "[resolvePublicPassportResponse] inline projection failed",
        {
          passportId: result.passport.id,
          upid,
          error: projection.error,
        },
      );
    }

    result = await getPublicDppByUpid(ctx.db, upid);

    if (!result.found || !result.passport) {
      return null;
    }
    if (result.productStatus !== "published") {
      return null;
    }

    if (projection.error && !result.snapshot) {
      throw internalServerError("Failed to materialize passport");
    }
  }

  return buildPublicPassportResponse(ctx.supabase, result);
}

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

      // Resolve image paths in passport to full URLs
      const resolvedBrandPassport = resolvePassportImageUrls(
        ctx.supabase,
        (theme?.passport as Record<string, unknown>) ?? null,
      );

      return {
        brandName: brand.name,
        brandPassport: resolvedBrandPassport,
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
      // Serve the public passport, projecting inline if the snapshot is stale.
      return resolvePublicPassportResponse(ctx, input.upid);
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

      // Resolve the live variant/passport by brand-scoped barcode.
      const passport = await getPublicPassportByBarcode(
        ctx.db,
        input.brandId,
        input.barcode,
      );

      if (!passport) {
        return null;
      }

      // Delegate to the same dirty-aware public resolver as the UPID route.
      return resolvePublicPassportResponse(ctx, passport.upid);
    }),
});

type DppPublicRouter = typeof dppPublicRouter;
