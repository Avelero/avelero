import {
  createBrand as createBrandRecord,
  deleteBrand as deleteBrandRecord,
  eq,
  getBrandsByUserId,
  getOwnerCountsByBrandIds,
  isSlugTaken,
  setActiveBrand,
  updateBrand as updateBrandRecord,
} from "@v1/db/queries";
import { brands } from "@v1/db/schema";
import { tasks } from "@trigger.dev/sdk/v3";
import { getAppUrl } from "@v1/utils/envs";
/**
 * Workflow brand operations implementation.
 *
 * Targets:
 * - workflow.list
 * - workflow.create
 * - workflow.delete
 */
import { ROLES } from "../../../config/roles.js";
import { revalidateBrand } from "../../../lib/dpp-revalidation.js";
import {
  workflowBrandIdSchema,
  workflowCreateSchema,
  workflowUpdateSchema,
} from "../../../schemas/workflow.js";
import { badRequest, wrapError } from "../../../utils/errors.js";
import { createSuccessResponse } from "../../../utils/response.js";
import {
  brandRequiredProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "../../init.js";
import { hasRole } from "../../middleware/auth/roles.js";

type BrandRole = "owner" | "member";

function buildBrandLogoUrl(path: string | null): string | null {
  if (!path) return null;
  const encoded = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${getAppUrl()}/api/storage/brand-avatars/${encoded}`;
}

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

function canLeaveFromRole(role: BrandRole, ownerCount: number): boolean {
  if (role !== "owner") return true;
  return ownerCount > 1;
}

export const workflowListProcedure = protectedProcedure.query(
  async ({ ctx }) => {
    const { db, user } = ctx;
    const memberships = await getBrandsByUserId(db, user.id);
    if (memberships.length === 0) return [];

    const ownerBrandIds = memberships
      .filter((brand) => brand.role === "owner")
      .map((brand) => brand.id);

    // Use standardized query function to get owner counts
    const ownerCounts = await getOwnerCountsByBrandIds(db, ownerBrandIds);

    return memberships.map((membership) => {
      const ownerCount = ownerCounts.get(membership.id) ?? 1;
      return {
        id: membership.id,
        name: membership.name,
        slug: membership.slug ?? null,
        email: membership.email ?? null,
        country_code: membership.country_code ?? null,
        avatar_hue: membership.avatar_hue ?? null,
        logo_url: buildBrandLogoUrl(membership.logo_path ?? null),
        role: membership.role,
        canLeave: canLeaveFromRole(membership.role, ownerCount),
      };
    });
  },
);

export const workflowCreateProcedure = protectedProcedure
  .input(workflowCreateSchema)
  .mutation(async ({ ctx, input }) => {
    const { db, user } = ctx;

    // Validate slug uniqueness if provided
    if (input.slug) {
      const taken = await isSlugTaken(db, input.slug);
      if (taken) {
        throw badRequest("This slug is already taken");
      }
    }

    const payload = {
      name: input.name,
      slug: input.slug ?? null,
      email: input.email ?? user.email ?? null,
      country_code: input.country_code ?? null,
      logo_path: extractStoragePath(input.logo_url),
      avatar_hue: input.avatar_hue ?? null,
    };

    try {
      return await createBrandRecord(db, user.id, payload);
    } catch (error) {
      throw wrapError(error, "Failed to create workflow");
    }
  });

export const workflowUpdateProcedure = brandRequiredProcedure
  .use(hasRole([ROLES.OWNER]))
  .input(workflowUpdateSchema)
  .mutation(async ({ ctx, input }) => {
    const { db, user, brandId } = ctx;
    if (brandId && brandId !== input.id) {
      throw badRequest(
        "Active brand does not match the workflow being updated",
      );
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
    if (input.avatar_hue !== undefined) {
      updatePayload.avatar_hue = input.avatar_hue;
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
      throw wrapError(error, "Failed to update workflow");
    }
  });

export const workflowSetActiveProcedure = protectedProcedure
  .input(workflowBrandIdSchema)
  .mutation(async ({ ctx, input }) => {
    const { db, user } = ctx;
    try {
      await setActiveBrand(db, user.id, input.brand_id);
      return createSuccessResponse();
    } catch (error) {
      throw wrapError(error, "Failed to set active workflow");
    }
  });

export const workflowDeleteProcedure = protectedProcedure
  .use(hasRole([ROLES.OWNER]))
  .input(workflowBrandIdSchema)
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
      throw wrapError(error, "Failed to delete workflow");
    }
  });

export const workflowBaseRouter = createTRPCRouter({
  list: workflowListProcedure,
  create: workflowCreateProcedure,
  update: workflowUpdateProcedure,
  setActive: workflowSetActiveProcedure,
  delete: workflowDeleteProcedure,
});

export type WorkflowBaseRouter = typeof workflowBaseRouter;
