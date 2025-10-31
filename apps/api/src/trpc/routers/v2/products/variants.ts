/**
 * Product variants router scaffold.
 *
 * Targets:
 * - products.variants.list
 * - products.variants.upsert
 */
import {
  brandRequiredProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "../../../init.js";

const variantListProcedure = protectedProcedure.query(async () => {
  throw new Error("products.variants.list is not implemented yet");
});

const variantUpsertProcedure = brandRequiredProcedure.mutation(async () => {
  throw new Error("products.variants.upsert is not implemented yet");
});

export const productVariantsRouter = createTRPCRouter({
  list: variantListProcedure,
  upsert: variantUpsertProcedure,
});

export type ProductVariantsRouter = typeof productVariantsRouter;
