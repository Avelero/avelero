/**
 * Variant management router.
 *
 * Handles CRUD operations for product variants and their identifiers.
 */
import {
  createVariant,
  deleteVariant,
  listVariants,
  updateVariant,
  upsertVariantIdentifier,
} from "@v1/db/queries";
import {
  createVariantSchema,
  deleteVariantSchema,
  listVariantsSchema,
  updateVariantSchema,
  upsertVariantIdentifierSchema,
} from "@api/schemas/index.ts";
import { createListResponse } from "@api/utils/response.ts";
import { createTRPCRouter, protectedProcedure } from "@api/trpc/init.ts";

/**
 * Router exposing variant-level operations nested under products.
 */
export const variantsRouter = createTRPCRouter({
  /**
   * Lists all variants for a given product.
   *
   * @param input - Product identifier.
   * @returns Array of variant records.
   */
  list: protectedProcedure
    .input(listVariantsSchema)
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const data = await listVariants(db, input.product_id);
      return createListResponse(data);
    }),

  /**
   * Creates a variant linked to the provided product.
   *
   * @param input - Variant details including color, size, and identifiers.
   * @returns Newly created variant record.
   */
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

  /**
   * Updates variant details such as sizing and identifiers.
   *
   * @param input - Variant fields that should be updated.
   * @returns Updated variant record.
   */
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

  /**
   * Deletes the specified variant.
   *
   * @param input - Identifier of the variant to remove.
   * @returns Identifier of the deleted variant when successful.
   */
  delete: protectedProcedure
    .input(deleteVariantSchema)
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      return deleteVariant(db, input.id);
    }),

  /**
   * Creates or updates an identifier on an existing variant.
   *
   * @param input - Identifier payload referencing the variant.
   * @returns Result of the upsert operation.
   */
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
});
