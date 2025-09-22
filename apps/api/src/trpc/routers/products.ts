import {
  createProduct,
  createVariant,
  deleteProduct,
  deleteVariant,
  getProduct,
  listProducts,
  listVariants,
  updateProduct,
  updateVariant,
  upsertProductIdentifier,
  upsertVariantIdentifier,
} from "@v1/db/queries";
import {
  createProductSchema,
  createVariantSchema,
  deleteProductSchema,
  deleteVariantSchema,
  getProductSchema,
  listProductsSchema,
  listVariantsSchema,
  updateProductSchema,
  updateVariantSchema,
  upsertProductIdentifierSchema,
  upsertVariantIdentifierSchema,
} from "../../schemas/products.js";
import { createTRPCRouter, protectedProcedure } from "../init.js";

export const productsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(listProductsSchema)
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      if (!brandId) return { data: [], meta: { total: 0 } } as const;
      const res = await listProducts(
        db,
        brandId,
        {
          categoryId: input.filters?.category_id,
          season: input.filters?.season,
          search: input.filters?.search,
        },
        { cursor: input.cursor, limit: input.limit },
      );
      return res;
    }),

  get: protectedProcedure
    .input(getProductSchema)
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      if (!brandId) return null;
      return getProduct(db, brandId, input.id);
    }),

  create: protectedProcedure
    .input(createProductSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      if (!brandId) throw new Error("No active brand");
      return createProduct(db, brandId, {
        name: input.name,
        description: input.description,
        categoryId: input.category_id,
        season: input.season,
        brandCertificationId: input.brand_certification_id,
        showcaseBrandId: input.showcase_brand_id,
        primaryImageUrl: input.primary_image_url,
      });
    }),

  update: protectedProcedure
    .input(updateProductSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      if (!brandId) throw new Error("No active brand");
      return updateProduct(db, brandId, {
        id: input.id,
        name: input.name,
        description: input.description ?? null,
        categoryId: input.category_id ?? null,
        season: input.season ?? null,
        brandCertificationId: input.brand_certification_id ?? null,
        showcaseBrandId: input.showcase_brand_id ?? null,
        primaryImageUrl: input.primary_image_url ?? null,
      });
    }),

  delete: protectedProcedure
    .input(deleteProductSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      if (!brandId) throw new Error("No active brand");
      return deleteProduct(db, brandId, input.id);
    }),

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

  variants: createTRPCRouter({
    list: protectedProcedure
      .input(listVariantsSchema)
      .query(async ({ ctx, input }) => {
        const { db } = ctx;
        const data = await listVariants(db, input.product_id);
        return { data } as const;
      }),
    create: protectedProcedure
      .input(createVariantSchema)
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;
        return createVariant(db, input.product_id, {
          colorId: input.color_id,
          sizeId: input.size_id,
          sku: input.sku,
          upid: input.upid,
          productImageUrl: input.product_image_url,
        });
      }),
    update: protectedProcedure
      .input(updateVariantSchema)
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;
        return updateVariant(db, input.id, {
          colorId: input.color_id ?? null,
          sizeId: input.size_id ?? null,
          sku: input.sku ?? null,
          upid: input.upid,
          productImageUrl: input.product_image_url ?? null,
        });
      }),
    delete: protectedProcedure
      .input(deleteVariantSchema)
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;
        return deleteVariant(db, input.id);
      }),
    upsertIdentifier: protectedProcedure
      .input(upsertVariantIdentifierSchema)
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;
        return upsertVariantIdentifier(
          db,
          input.variant_id,
          input.id_type,
          input.value,
        );
      }),
  }),
});
