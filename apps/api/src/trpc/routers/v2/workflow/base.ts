/**
 * Workflow brand operations implementation.
 *
 * Targets:
 * - workflow.list
 * - workflow.create
 * - workflow.delete
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  createBrand as createBrandRecord,
  deleteBrand as deleteBrandRecord,
  getBrandsByUserId,
} from "@v1/db/queries";
import { brandMembers } from "@v1/db/schema";
import { getAppUrl } from "@v1/utils/envs";
import { ROLES } from "../../../../config/roles.js";
import {
  workflowBrandIdSchema,
  workflowCreateSchema,
} from "../../../../schemas/workflow.js";
import { badRequest, wrapError } from "../../../../utils/errors.js";
import { createTRPCRouter, protectedProcedure } from "../../../init.js";
import { hasRole } from "../../../middleware/auth/roles.js";

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

    const ownerCounts = new Map<string, number>();
    if (ownerBrandIds.length > 0) {
      const rows = await db
        .select({
          brandId: brandMembers.brandId,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(brandMembers)
        .where(
          and(
            inArray(brandMembers.brandId, ownerBrandIds),
            eq(brandMembers.role, "owner"),
          ),
        )
        .groupBy(brandMembers.brandId);

      for (const row of rows) {
        ownerCounts.set(row.brandId, row.count);
      }
    }

    return memberships.map((membership) => {
      const ownerCount = ownerCounts.get(membership.id) ?? 1;
      return {
        id: membership.id,
        name: membership.name,
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
    const payload = {
      name: input.name,
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

export const workflowDeleteProcedure = protectedProcedure
  .use(hasRole([ROLES.OWNER]))
  .input(workflowBrandIdSchema)
  .mutation(async ({ ctx, input }) => {
    const { db, supabaseAdmin, user } = ctx;
    const brandId = input.brand_id;
    if (!brandId) {
      throw badRequest("Brand id is required");
    }

    if (supabaseAdmin) {
      const { data: files } = await supabaseAdmin.storage
        .from("brand-avatars")
        .list(brandId);

      if (files && files.length > 0) {
        const filePaths = files.map((file) => `${brandId}/${file.name}`);
        await supabaseAdmin.storage.from("brand-avatars").remove(filePaths);
      }
    }

    try {
      const result = await deleteBrandRecord(db, brandId, user.id);
      return result;
    } catch (error) {
      throw wrapError(error, "Failed to delete workflow");
    }
  });

export const workflowBaseRouter = createTRPCRouter({
  list: workflowListProcedure,
  create: workflowCreateProcedure,
  delete: workflowDeleteProcedure,
});

export type WorkflowBaseRouter = typeof workflowBaseRouter;
