/**
 * Passport templates router implementation.
 *
 * Targets:
 * - passports.templates.list
 * - passports.templates.get
 * - passports.templates.create
 * - passports.templates.update
 *
 * Supports replace-all semantics for module configuration and leverages
 * completion delta helpers to keep passport module completion in sync.
 */
import {
  createPassportTemplate,
  deletePassportTemplate,
  getPassportTemplateWithModules,
  listPassportTemplatesForBrand,
  updatePassportTemplate,
} from "@v1/db/queries";
import {
  passportTemplatesCreateSchema,
  passportTemplatesDeleteSchema,
  passportTemplatesGetSchema,
  passportTemplatesListSchema,
  passportTemplatesUpdateSchema,
} from "../../../../schemas/passports.js";
import { badRequest, notFound, wrapError } from "../../../../utils/errors.js";
import {
  createEntityResponse,
  createListResponse,
  createSuccessResponse,
} from "../../../../utils/response.js";
import type { AuthenticatedTRPCContext } from "../../../init.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../../init.js";

type BrandContext = AuthenticatedTRPCContext & { brandId: string };

function ensureBrandScope(
  ctx: BrandContext,
  requested?: string | null,
): string {
  const active = ctx.brandId;
  if (!active) {
    throw badRequest("Active brand context required");
  }
  if (requested && requested !== active) {
    throw badRequest("Active brand does not match requested brand_id");
  }
  return active;
}

export const passportTemplatesRouter = createTRPCRouter({
  list: brandRequiredProcedure
    .input(passportTemplatesListSchema.optional())
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = ensureBrandScope(brandCtx, input?.brand_id ?? null);
      try {
        const templates = await listPassportTemplatesForBrand(
          brandCtx.db,
          brandId,
        );
        return createListResponse(templates);
      } catch (error) {
        throw wrapError(error, "Failed to list passport templates");
      }
    }),

  get: brandRequiredProcedure
    .input(passportTemplatesGetSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      ensureBrandScope(brandCtx);
      try {
        const template = await getPassportTemplateWithModules(
          brandCtx.db,
          brandCtx.brandId,
          input.id,
        );
        if (!template) {
          throw notFound("Passport template", input.id);
        }
        return createEntityResponse(template);
      } catch (error) {
        throw wrapError(error, "Failed to load passport template");
      }
    }),

  create: brandRequiredProcedure
    .input(passportTemplatesCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = ensureBrandScope(brandCtx, input.brand_id);
      try {
        const template = await createPassportTemplate(brandCtx.db, brandId, {
          name: input.name,
          theme: input.theme ?? {},
          modules: input.modules?.map((module, index) => ({
            module_key: module.module_key,
            enabled: module.enabled ?? true,
            sort_index: module.sort_index ?? index,
          })),
        });
        return createEntityResponse(template);
      } catch (error) {
        throw wrapError(error, "Failed to create passport template");
      }
    }),

  update: brandRequiredProcedure
    .input(passportTemplatesUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      ensureBrandScope(brandCtx);
      try {
        const updated = await updatePassportTemplate(
          brandCtx.db,
          brandCtx.brandId,
          {
            id: input.id,
            name: input.name,
            theme: input.theme,
            modules: input.modules?.map((module, index) => ({
              module_key: module.module_key,
              enabled: module.enabled ?? true,
              sort_index: module.sort_index ?? index,
            })),
          },
        );
        if (!updated) {
          throw notFound("Passport template", input.id);
        }
        return createEntityResponse(updated);
      } catch (error) {
        throw wrapError(error, "Failed to update passport template");
      }
    }),

  delete: brandRequiredProcedure
    .input(passportTemplatesDeleteSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      ensureBrandScope(brandCtx);
      try {
        const deleted = await deletePassportTemplate(
          brandCtx.db,
          brandCtx.brandId,
          input.id,
        );
        if (!deleted) {
          throw notFound("Passport template", input.id);
        }
        return createSuccessResponse();
      } catch (error) {
        throw wrapError(error, "Failed to delete passport template");
      }
    }),
});

export type PassportTemplatesRouter = typeof passportTemplatesRouter;
