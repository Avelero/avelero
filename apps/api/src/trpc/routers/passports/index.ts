/**
 * Passports domain router implementation.
 *
 * Covers passport CRUD operations and mounts nested template management under
 * `passports.templates.*`. Implements the spec outlined in
 * `docs/NEW_API_ENDPOINTS.txt`.
 */
import {
  createPassport,
  deletePassport,
  getPassportByUpid,
  listPassportsForBrand,
  updatePassport,
} from "@v1/db/queries";
import {
  passportsCreateSchema,
  passportsDeleteSchema,
  passportsGetSchema,
  passportsListSchema,
  passportsUpdateSchema,
} from "../../../schemas/passports.js";
import { badRequest, notFound, wrapError } from "../../../utils/errors.js";
import {
  createEntityResponse,
  createSuccessResponse,
} from "../../../utils/response.js";
import type { AuthenticatedTRPCContext } from "../../init.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";
import { passportTemplatesRouter } from "./templates/index.js";

type BrandContext = AuthenticatedTRPCContext & { brandId: string };

export const passportsRouter = createTRPCRouter({
  list: brandRequiredProcedure
    .input(passportsListSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      try {
        const result = await listPassportsForBrand(
          brandCtx.db,
          brandCtx.brandId,
          {
            page: input.page,
            includeStatusCounts: input.includeStatusCounts,
            filters: input.filters,
          },
        );
        return {
          data: result.data,
          meta: {
            total: result.meta.total,
            ...(result.meta.statusCounts
              ? { statusCounts: result.meta.statusCounts }
              : {}),
          },
        };
      } catch (error) {
        throw wrapError(error, "Failed to list passports");
      }
    }),

  get: brandRequiredProcedure
    .input(passportsGetSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      try {
        return await getPassportByUpid(
          brandCtx.db,
          brandCtx.brandId,
          input.upid,
        );
      } catch (error) {
        throw wrapError(error, "Failed to load passport");
      }
    }),

  create: brandRequiredProcedure
    .input(passportsCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      try {
        const passport = await createPassport(brandCtx.db, brandCtx.brandId, {
          productId: input.product_id,
          variantId: input.variant_id,
          templateId: input.template_id ?? null,
          status: input.status,
        });
        return createEntityResponse(passport);
      } catch (error) {
        throw wrapError(error, "Failed to create passport");
      }
    }),

  update: brandRequiredProcedure
    .input(passportsUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      try {
        const passport = await updatePassport(
          brandCtx.db,
          brandCtx.brandId,
          input.upid,
          {
            status: input.status,
            templateId: input.template_id,
          },
        );
        return createEntityResponse(passport);
      } catch (error) {
        throw wrapError(error, "Failed to update passport");
      }
    }),

  delete: brandRequiredProcedure
    .input(passportsDeleteSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      try {
        const result = await deletePassport(
          brandCtx.db,
          brandCtx.brandId,
          input.upid,
        );
        if (!result) {
          throw notFound("Passport", input.upid);
        }
        return createSuccessResponse();
      } catch (error) {
        throw wrapError(error, "Failed to delete passport");
      }
    }),

  templates: passportTemplatesRouter,
});

export type PassportsRouter = typeof passportsRouter;
