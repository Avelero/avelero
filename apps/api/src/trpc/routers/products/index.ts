/**
 * Products domain router implementation.
 *
 * Exposes product CRUD operations along with nested routers for variants and
 * attribute writers. Supports include flags that collapse N+1 queries into
 * batched lookups handled by the database layer.
 */
import {
  createProduct,
  deleteProduct,
  getProductWithIncludes,
  listProductsWithIncludes,
  setProductCareCodes,
  setProductEcoClaims,
  setProductJourneySteps,
  updateProduct,
  upsertProductEnvironment,
  upsertProductMaterials,
} from "@v1/db/queries";
import {
  productsDomainCreateSchema,
  productsDomainDeleteSchema,
  productsDomainGetSchema,
  productsDomainListSchema,
  productsDomainUpdateSchema,
} from "../../../schemas/products.js";
import { badRequest, wrapError } from "../../../utils/errors.js";
import {
  createEntityResponse,
  createPaginatedResponse,
} from "../../../utils/response.js";
import type { AuthenticatedTRPCContext } from "../../init.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";
import { productVariantsRouter } from "./variants.js";

type BrandContext = AuthenticatedTRPCContext & { brandId: string };

function ensureBrandScope(
  ctx: BrandContext,
  requestedBrandId?: string | null,
): string {
  const activeBrandId = ctx.brandId;
  if (requestedBrandId && requestedBrandId !== activeBrandId) {
    throw badRequest("Active brand does not match the requested brand_id");
  }
  return activeBrandId;
}

function normalizeBrandId(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export const productsRouter = createTRPCRouter({
  list: brandRequiredProcedure
    .input(productsDomainListSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = ensureBrandScope(
        brandCtx,
        normalizeBrandId(input.brand_id),
      );

      const result = await listProductsWithIncludes(
        brandCtx.db,
        brandId,
        {
          categoryId: input.filters?.category_id,
          season: input.filters?.season,
          search: input.filters?.search,
        },
        {
          cursor: input.cursor,
          limit: input.limit,
          fields: input.fields,
          includeVariants: input.includeVariants,
          includeAttributes: input.includeAttributes,
        },
      );

      return createPaginatedResponse([...result.data], {
        total: result.meta.total,
        cursor: result.meta.cursor,
        hasMore: result.meta.hasMore,
      });
    }),

  get: brandRequiredProcedure
    .input(productsDomainGetSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = ensureBrandScope(brandCtx);
      return getProductWithIncludes(brandCtx.db, brandId, input.id, {
        includeVariants: input.includeVariants,
        includeAttributes: input.includeAttributes,
      });
    }),

  create: brandRequiredProcedure
    .input(productsDomainCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = ensureBrandScope(brandCtx, input.brand_id);

      try {
        const product = await createProduct(brandCtx.db, brandId, {
          name: input.name,
          productIdentifier: input.product_identifier,
          description: input.description,
          categoryId: input.category_id,
          season: input.season, // Legacy: deprecated, use seasonId
          seasonId: input.season_id,
          brandCertificationId: input.brand_certification_id,
          showcaseBrandId: input.showcase_brand_id,
          primaryImageUrl: input.primary_image_url,
        });
        return createEntityResponse(product);
      } catch (error) {
        throw wrapError(error, "Failed to create product");
      }
    }),

  update: brandRequiredProcedure
    .input(productsDomainUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = ensureBrandScope(
        brandCtx,
        normalizeBrandId(input.brand_id),
      );

      try {
        // Update basic product fields
        const product = await updateProduct(brandCtx.db, brandId, {
          id: input.id,
          name: input.name,
          description: input.description ?? null,
          categoryId: input.category_id ?? null,
          season: input.season ?? null, // Legacy: deprecated, use seasonId
          seasonId: input.season_id ?? null,
          brandCertificationId: input.brand_certification_id ?? null,
          showcaseBrandId: input.showcase_brand_id ?? null,
          primaryImageUrl: input.primary_image_url ?? null,
        });

        // Update product attributes if provided
        // Each attribute update triggers module completion evaluation
        if (input.materials && Array.isArray(input.materials)) {
          await upsertProductMaterials(
            brandCtx.db,
            input.id,
            input.materials.map((m: any) => ({
              brandMaterialId: m.brand_material_id,
              percentage: m.percentage,
            })),
          );
        }

        if (input.careCodes && Array.isArray(input.careCodes)) {
          await setProductCareCodes(
            brandCtx.db,
            input.id,
            input.careCodes as string[],
          );
        }

        if (input.ecoClaims && Array.isArray(input.ecoClaims)) {
          await setProductEcoClaims(
            brandCtx.db,
            input.id,
            input.ecoClaims as string[],
          );
        }

        if (input.environment && typeof input.environment === "object") {
          await upsertProductEnvironment(brandCtx.db, input.id, {
            carbonKgCo2e: (input.environment as any).carbon_kg_co2e,
            waterLiters: (input.environment as any).water_liters,
          });
        }

        if (input.journeySteps && Array.isArray(input.journeySteps)) {
          await setProductJourneySteps(
            brandCtx.db,
            input.id,
            input.journeySteps.map((step: any) => ({
              sortIndex: step.sort_index,
              stepType: step.step_type,
              facilityId: step.facility_id,
            })),
          );
        }

        return createEntityResponse(product);
      } catch (error) {
        throw wrapError(error, "Failed to update product");
      }
    }),

  delete: brandRequiredProcedure
    .input(productsDomainDeleteSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = ensureBrandScope(
        brandCtx,
        normalizeBrandId(input.brand_id),
      );

      try {
        const deleted = await deleteProduct(brandCtx.db, brandId, input.id);
        return createEntityResponse(deleted);
      } catch (error) {
        throw wrapError(error, "Failed to delete product");
      }
    }),

  variants: productVariantsRouter,
});

export type ProductsRouter = typeof productsRouter;