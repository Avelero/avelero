/**
 * Bulk operations router implementation.
 *
 * Centralizes batch mutations that were previously scattered across domains.
 * Currently supports product imports and passport bulk updates with guardrails
 * for future domain support.
 */
import {
  bulkUpdatePassports,
  createProduct,
  type BulkChanges as PassportBulkChanges,
  type BulkSelection as PassportBulkSelection,
} from "@v1/db/queries";
import {
  bulkImportSchema,
  bulkUpdateSchema,
  type BulkSelectionInput,
} from "../../../../schemas/bulk.js";
import {
  badRequest,
  wrapError,
} from "../../../../utils/errors.js";
import {
  createBatchResponse,
  createSuccessWithMeta,
} from "../../../../utils/response.js";
import type { AuthenticatedTRPCContext } from "../../../init.js";
import {
  brandRequiredProcedure,
  createTRPCRouter,
} from "../../../init.js";

type BrandContext = AuthenticatedTRPCContext & { brandId: string };

function ensureBrand(ctx: AuthenticatedTRPCContext): asserts ctx is BrandContext {
  if (!ctx.brandId) {
    throw badRequest("Active brand context required");
  }
}

function assertBrandScope(
  ctx: AuthenticatedTRPCContext,
  requestedBrandId?: string | null,
): string {
  ensureBrand(ctx);
  const activeBrandId = ctx.brandId;
  if (requestedBrandId && requestedBrandId !== activeBrandId) {
    throw badRequest("Active brand does not match the requested brand_id");
  }
  return activeBrandId;
}

function toPassportSelection(
  selection: BulkSelectionInput,
): PassportBulkSelection {
  if (selection.mode === "all") {
    return {
      mode: "all",
      excludeIds: selection.excludeIds ?? [],
    };
  }

  return {
    mode: "explicit",
    includeIds: [...selection.includeIds],
  };
}

export const bulkRouter = createTRPCRouter({
  import: brandRequiredProcedure
    .input(bulkImportSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = assertBrandScope(brandCtx, input.brand_id);

      if (input.domain !== "products") {
        throw badRequest(`Unsupported bulk import domain: ${input.domain}`);
      }

      try {
        const created: Array<{ id: string }> = [];
        for (const item of input.items) {
          const product = await createProduct(brandCtx.db, brandId, {
            name: item.name,
            description: item.description ?? null,
            categoryId: item.category_id ?? null,
            season: item.season ?? null,
            brandCertificationId: item.brand_certification_id ?? null,
            showcaseBrandId: item.showcase_brand_id ?? null,
            primaryImageUrl: item.primary_image_url ?? null,
          });
          if (product?.id) {
            created.push({ id: product.id });
          }
        }

        return createSuccessWithMeta({
          domain: input.domain,
          created: created.length,
          products: created,
        });
      } catch (error) {
        throw wrapError(error, "Failed to import products");
      }
    }),

  update: brandRequiredProcedure
    .input(bulkUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;

      switch (input.domain) {
        case "passports": {
          const selection = toPassportSelection(input.selection);
          const changes: PassportBulkChanges = {};
          if (input.changes.status) {
            changes.status = input.changes.status;
          }

          try {
            const affected = await bulkUpdatePassports(
              brandCtx.db,
              brandCtx.brandId,
              selection,
              changes,
            );
            return createBatchResponse(affected);
          } catch (error) {
            throw wrapError(error, "Failed to bulk update passports");
          }
        }

        case "products":
        case "brand": {
          throw badRequest(
            `Bulk update for domain '${input.domain}' is not implemented yet`,
          );
        }
      }
    }),
});

export type BulkRouter = typeof bulkRouter;
