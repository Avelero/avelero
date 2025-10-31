/**
 * Product catalog API.
 *
 * Exposes CRUD operations for products and mounts variant-related procedures.
 */
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
  upsertProductIdentifier,
} from "@v1/db/queries";
import {
  createProductSchema,
  deleteProductSchema,
  getProductSchema,
  listProductsSchema,
  updateProductSchema,
  upsertProductIdentifierSchema,
} from "@api/schemas/index.ts";
import {
  createEmptyPaginatedResponse,
  createEntityResponse,
  createPaginatedResponse,
} from "@api/utils/response.ts";
import {
  brandRequiredProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@api/trpc/init.ts";
import { variantsRouter } from "./variants.js";

/**
 * tRPC router covering product management operations.
 */
export const productsRouter = createTRPCRouter({
  /**
   * Lists products for the active brand with optional filters and pagination.
   *
   * @param input - Cursor pagination and filter options.
   * @returns Paged product list including total count metadata.
   */
  list: protectedProcedure
    .input(listProductsSchema)
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      if (!brandId) return createEmptyPaginatedResponse();
      const res = await listProducts(
        db,
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
        },
      );
      return createPaginatedResponse([...res.data], {
        total: res.meta.total,
        cursor: res.meta.cursor,
        hasMore: res.meta.hasMore,
      });
    }),

  /**
   * Loads a single product belonging to the active brand.
   *
   * @param input - Product identifier.
   * @returns Matching product record or `null` when not found.
   */
  get: protectedProcedure
    .input(getProductSchema)
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      if (!brandId) return null;
      return getProduct(db, brandId, input.id);
    }),

  /**
   * Creates a new product within the active brand.
   *
   * @param input - Product details defined by `createProductSchema`.
   * @returns Newly created product record.
   */
  create: brandRequiredProcedure
    .input(createProductSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      const product = await createProduct(db, brandId, {
        name: input.name,
        description: input.description,
        categoryId: input.category_id,
        season: input.season,
        brandCertificationId: input.brand_certification_id,
        showcaseBrandId: input.showcase_brand_id,
        primaryImageUrl: input.primary_image_url,
      });
      return createEntityResponse(product);
    }),

  /**
   * Updates an existing product associated with the active brand.
   *
   * @param input - Partial product fields to update.
   * @returns Updated product record.
   */
  update: brandRequiredProcedure
    .input(updateProductSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      const product = await updateProduct(db, brandId, {
        id: input.id,
        name: input.name,
        description: input.description ?? null,
        categoryId: input.category_id ?? null,
        season: input.season ?? null,
        brandCertificationId: input.brand_certification_id ?? null,
        showcaseBrandId: input.showcase_brand_id ?? null,
        primaryImageUrl: input.primary_image_url ?? null,
      });
      return createEntityResponse(product);
    }),

  /**
   * Deletes a product owned by the active brand.
   *
   * @param input - Identifier of the product to remove.
   * @returns Identifier of the deleted product when successful.
   */
  delete: brandRequiredProcedure
    .input(deleteProductSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      const deleted = await deleteProduct(db, brandId, input.id);
      return createEntityResponse(deleted);
    }),

  /**
   * Creates or updates a product-level identifier (for GTINs, SKUs, etc.).
   *
   * @param input - Identifier payload referencing the product.
   * @returns Result of the upsert operation.
   */
  upsertIdentifier: protectedProcedure
    .input(upsertProductIdentifierSchema)
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      return upsertProductIdentifier(
        db,
        input.product_id,
        input.id_type,
        input.value,
      );
    }),

  /**
   * Nested router for variant-specific operations.
   */
  variants: variantsRouter,
});
