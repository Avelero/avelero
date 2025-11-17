/**
 * Product variants router implementation.
 *
 * Covers the nested `products.variants.*` namespace responsible for variant
 * listings, bulk upserts, and explicit delete operations.
 */
import {
  deleteProductVariantsForBrand,
  listProductVariantsForBrand,
  upsertProductVariantsForBrand,
} from "@v1/db/queries";
import {
  listVariantsSchema,
  productVariantsDeleteSchema,
  productVariantsUpsertSchema,
} from "../../../schemas/products.js";
import { wrapError } from "../../../utils/errors.js";
import {
  createBatchResponse,
  createListResponse,
} from "../../../utils/response.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";

const variantListProcedure = brandRequiredProcedure
  .input(listVariantsSchema)
  .query(async ({ ctx, input }) => {
    const { db, brandId } = ctx;
    const variants = await listProductVariantsForBrand(
      db,
      brandId as string,
      input.product_id,
    );
    return createListResponse([...variants]);
  });

const variantUpsertProcedure = brandRequiredProcedure
  .input(productVariantsUpsertSchema)
  .mutation(async ({ ctx, input }) => {
    const { db, brandId } = ctx;
    try {
      const results = await upsertProductVariantsForBrand(
        db,
        brandId as string,
        input.product_id,
        input.variants,
      );
      return createListResponse(results);
    } catch (error) {
      throw wrapError(error, "Failed to upsert product variants");
    }
  });

const variantDeleteProcedure = brandRequiredProcedure
  .input(productVariantsDeleteSchema)
  .mutation(async ({ ctx, input }) => {
    const { db, brandId } = ctx;
    try {
      const affected = await deleteProductVariantsForBrand(
        db,
        brandId as string,
        input,
      );
      return createBatchResponse(affected);
    } catch (error) {
      throw wrapError(error, "Failed to delete product variants");
    }
  });

export const productVariantsRouter = createTRPCRouter({
  list: variantListProcedure,
  upsert: variantUpsertProcedure,
  delete: variantDeleteProcedure,
});

export type ProductVariantsRouter = typeof productVariantsRouter;