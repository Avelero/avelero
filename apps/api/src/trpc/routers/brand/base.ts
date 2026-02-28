import { tasks } from "@trigger.dev/sdk/v3";
import { eq } from "@v1/db/queries";
import {
  deleteBrand as deleteBrandRecord,
  isSlugTaken,
  updateBrand as updateBrandRecord,
} from "@v1/db/queries/brand";
import { brands } from "@v1/db/schema";
import { getAppUrl } from "@v1/utils/envs";
/**
 * Brand lifecycle operations implementation.
 *
 * Phase 4 changes:
 * - Renamed from workflow to brand
 * - Removed list, create, setActive (moved to user.brands.*)
 * - Kept update, delete only
 *
 * Targets:
 * - brand.update
 * - brand.delete
 */
import { OWNER_EQUIVALENT_ROLES } from "../../../config/roles.js";
import { revalidateBrand } from "../../../lib/dpp-revalidation.js";
import { brandIdSchema, brandUpdateSchema } from "../../../schemas/brand.js";
import { badRequest, wrapError } from "../../../utils/errors.js";
import { brandRequiredProcedure, protectedProcedure } from "../../init.js";
import { hasRole } from "../../middleware/auth/roles.js";

function extractStoragePath(url: string | null | undefined): string | null {
  if (!url) return null;
  const knownPrefixes = [
    "/api/storage/brand-avatars/",
    `${getAppUrl()}/api/storage/brand-avatars/`,
  ];
  for (const prefix of knownPrefixes) {
    if (url.startsWith(prefix)) {
      return url.slice(prefix.length);
    }
  }
  const match = url.match(/brand-avatars\/(.+)$/);
  if (match) {
    return match[1] ?? null;
  }
  return url;
}

/**
 * Updates brand details.
 * Only accessible by brand owners.
 */
export const brandUpdateProcedure = brandRequiredProcedure
  .use(hasRole(OWNER_EQUIVALENT_ROLES))
  .input(brandUpdateSchema)
  .mutation(async ({ ctx, input }) => {
    const { db, user, brandId } = ctx;
    if (brandId && brandId !== input.id) {
      throw badRequest("Active brand does not match the brand being updated");
    }

    // Validate slug uniqueness if being updated
    if (input.slug !== undefined && input.slug !== null) {
      const taken = await isSlugTaken(db, input.slug, input.id);
      if (taken) {
        throw badRequest("This slug is already taken");
      }
    }

    // Get old slug before update for DPP cache revalidation
    const [oldBrand] = await db
      .select({ slug: brands.slug })
      .from(brands)
      .where(eq(brands.id, input.id))
      .limit(1);
    const oldSlug = oldBrand?.slug;

    const updatePayload: Parameters<typeof updateBrandRecord>[2] = {
      id: input.id,
    };

    if (input.name !== undefined) {
      updatePayload.name = input.name;
    }
    if (input.slug !== undefined) {
      updatePayload.slug = input.slug;
    }
    if (input.email !== undefined) {
      updatePayload.email = input.email;
    }
    if (input.country_code !== undefined) {
      updatePayload.country_code = input.country_code;
    }
    if (input.logo_url !== undefined) {
      updatePayload.logo_path = extractStoragePath(input.logo_url);
    }

    try {
      const result = await updateBrandRecord(db, user.id, updatePayload);

      // Revalidate DPP cache when slug changes (fire-and-forget)
      // Both old and new slugs need to be revalidated
      if (input.slug !== undefined && oldSlug && oldSlug !== input.slug) {
        revalidateBrand(oldSlug).catch(() => {});
      }
      if (result.slug) {
        revalidateBrand(result.slug).catch(() => {});
      }

      return { success: true, slug: result.slug ?? null };
    } catch (error) {
      throw wrapError(error, "Failed to update brand");
    }
  });

/**
 * Deletes a brand (soft-delete).
 * Only accessible by brand owners.
 * Triggers background job for cleanup.
 */
export const brandDeleteProcedure = protectedProcedure
  .use(hasRole(OWNER_EQUIVALENT_ROLES))
  .input(brandIdSchema)
  .mutation(async ({ ctx, input }) => {
    const { db, user } = ctx;
    const brandId = input.brand_id;
    if (!brandId) {
      throw badRequest("Brand id is required");
    }

    try {
      // Soft-delete the brand (sets deleted_at, updates affected users' active brand)
      // This is fast and returns immediately
      const result = await deleteBrandRecord(db, brandId, user.id);

      // Trigger background job to handle the heavy lifting:
      // - Delete products in batches
      // - Clean up storage files (avatars, product images, etc.)
      // - Hard-delete the brand row
      try {
        await tasks.trigger("delete-brand", {
          brandId,
          userId: user.id,
        });
      } catch (triggerError) {
        // Log but don't fail - the brand is already soft-deleted
        // The background job can be manually re-triggered if needed
        console.error("Failed to trigger delete-brand job:", triggerError);
      }

      return result;
    } catch (error) {
      throw wrapError(error, "Failed to delete brand");
    }
  });

import { z } from "zod";

/**
 * Checks if a slug is available for use.
 * Used for real-time validation during slug editing.
 */
export const brandCheckSlugProcedure = brandRequiredProcedure
  .input(z.object({ slug: z.string().min(1) }))
  .query(async ({ ctx, input }) => {
    const { db, brandId } = ctx;

    // Check if slug is taken by another brand (excluding current brand)
    const taken = await isSlugTaken(db, input.slug, brandId);

    return { available: !taken };
  });
