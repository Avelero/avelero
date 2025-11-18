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
  updateProduct,
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

type CreateProductInput = Parameters<typeof createProduct>[2];
type UpdateProductInput = Parameters<typeof updateProduct>[2];

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
        ({
          categoryId: input.filters?.category_id,
          seasonId: input.filters?.season_id,
          search: input.filters?.search,
        } as unknown as Parameters<typeof listProductsWithIncludes>[2]),
        {
          cursor: input.cursor,
          limit: input.limit,
          fields: input.fields as unknown as Parameters<
            typeof listProductsWithIncludes
          >[3]["fields"],
          includeVariants: input.includeVariants,
          includeAttributes: false,
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
        includeAttributes: false,
      });
    }),

  create: brandRequiredProcedure
    .input(productsDomainCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = ensureBrandScope(brandCtx, input.brand_id);

      try {
        const payload: Record<string, unknown> = {
          name: input.name,
          upid: input.upid,
          productIdentifier: input.product_identifier,
          description: input.description ?? null,
          categoryId: input.category_id ?? null,
          seasonId: input.season_id ?? null,
          showcaseBrandId: input.showcase_brand_id ?? null,
          primaryImageUrl: input.primary_image_url ?? null,
          templateId: input.template_id ?? null,
          status: input.status ?? undefined,
        };

        const product = await createProduct(
          brandCtx.db,
          brandId,
          payload as CreateProductInput,
        );

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
        const payload: Record<string, unknown> = {
          id: input.id,
          productIdentifier: input.product_identifier,
          upid: input.upid ?? null,
          name: input.name,
          description: input.description ?? null,
          categoryId: input.category_id ?? null,
          seasonId: input.season_id ?? null,
          showcaseBrandId: input.showcase_brand_id ?? null,
          primaryImageUrl: input.primary_image_url ?? null,
          templateId: input.template_id ?? null,
          status: input.status ?? undefined,
        };

        const product = await updateProduct(
          brandCtx.db,
          brandId,
          payload as UpdateProductInput,
        );

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
