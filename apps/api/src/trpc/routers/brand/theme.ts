import { eq } from "@v1/db/queries";
/**
 * Brand theme router.
 *
 * Handles reading and writing the brand's Passport (single JSON document
 * containing tokens, layout, and per-section styles).
 *
 * Targets:
 * - brand.theme.get - Get passport (with resolved image URLs)
 * - brand.theme.update - Update passport
 */
import { getBrandTheme, updatePassport } from "@v1/db/queries/brand";
import { brands } from "@v1/db/schema";
import { z } from "zod";
import { revalidateBrand } from "../../../lib/dpp-revalidation.js";
import { wrapError } from "../../../utils/errors.js";
import {
  normalizePassportImagePathsForStorage,
  resolvePassportImageUrls,
} from "../../../utils/theme-config-images.js";
import {
  brandReadProcedure,
  brandWriteProcedure,
  createTRPCRouter,
} from "../../init.js";

/**
 * Get passport data for the active brand.
 */
const getThemeProcedure = brandReadProcedure.query(async ({ ctx }) => {
  const { db, brandId, supabase } = ctx;
  try {
    const theme = await getBrandTheme(db, brandId);
    if (!theme) {
      return {
        passport: {},
        updatedAt: null,
      };
    }

    const resolvedPassport = resolvePassportImageUrls(
      supabase,
      (theme.passport as Record<string, unknown>) ?? {},
    );

    return {
      passport: resolvedPassport,
      updatedAt: theme.updatedAt,
    };
  } catch (error) {
    throw wrapError(error, "Failed to fetch theme");
  }
});

/**
 * Update the passport for the active brand.
 */
const updateConfigProcedure = brandWriteProcedure
  .input(
    z.object({
      passport: z.record(z.unknown()),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const { db, brandId } = ctx;
    try {
      const normalizedPassport = normalizePassportImagePathsForStorage(
        input.passport,
      );
      const result = await updatePassport(db, brandId, normalizedPassport);

      // Revalidate all DPP pages for this brand (fire-and-forget)
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
        // Silently ignore revalidation errors - the passport update already succeeded
      }

      return result;
    } catch (error) {
      throw wrapError(error, "Failed to update passport");
    }
  });

export const brandThemeRouter = createTRPCRouter({
  get: getThemeProcedure,
  update: updateConfigProcedure,
});

type BrandThemeRouter = typeof brandThemeRouter;
