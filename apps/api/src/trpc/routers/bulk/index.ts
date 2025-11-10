/**
 * Bulk operations router implementation.
 *
 * Structure:
 * - import.*: Async bulk import lifecycle (validate, start, status, approve, cancel)
 * - staging.*: Staging data operations (preview, errors, export)
 * - values.*: Value mapping operations (unmapped, define, batchDefine)
 * - import (legacy): Synchronous product import (deprecated)
 * - update: Passport bulk updates
 */
import {
  type BulkChanges as PassportBulkChanges,
  type BulkSelection as PassportBulkSelection,
  bulkUpdatePassports,
  createProduct,
} from "@v1/db/queries";
import {
  type BulkSelectionInput,
  bulkImportSchema,
  bulkUpdateSchema,
} from "../../../schemas/bulk.js";
import { badRequest, wrapError } from "../../../utils/errors.js";
import {
  createBatchResponse,
  createSuccessWithMeta,
} from "../../../utils/response.js";
import type { AuthenticatedTRPCContext } from "../../init.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";
import { importRouter } from "./import.js";
import { stagingRouter } from "./staging.js";
import { valuesRouter } from "./values.js";

type BrandContext = AuthenticatedTRPCContext & { brandId: string };

function ensureBrand(
  ctx: AuthenticatedTRPCContext,
): asserts ctx is BrandContext {
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

/**
 * Main bulk operations router with nested routers
 */
export const bulkRouter = createTRPCRouter({
  /**
   * Nested routers for async bulk import operations
   */
  import: importRouter,
  staging: stagingRouter,
  values: valuesRouter,

  /**
   * LEGACY: Synchronous product import
   * @deprecated Use bulk.import.* endpoints instead
   *
   * Kept for backwards compatibility. Directly creates products
   * without validation or staging.
   */
  importLegacy: brandRequiredProcedure
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
            description: item.description ?? undefined,
            categoryId: item.category_id ?? undefined,
            season: item.season ?? undefined,
            brandCertificationId: item.brand_certification_id ?? undefined,
            showcaseBrandId: item.showcase_brand_id ?? undefined,
            primaryImageUrl: item.primary_image_url ?? undefined,
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

  /**
   * Bulk update passports
   *
   * Supports bulk status changes for passports.
   * Uses explicit selection (IDs) or "all with excludes" pattern.
   */
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
