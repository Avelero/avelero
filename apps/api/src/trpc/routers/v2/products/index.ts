/**
 * Products domain router scaffold.
 *
 * Combines product CRUD, variant management, and nested attribute writers
 * under the reorganized API surface.
 */
import {
  brandRequiredProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "../../../init.js";
import { productVariantsRouter } from "./variants.js";
import { productAttributesRouter } from "./attributes/index.js";

const productListProcedure = protectedProcedure.query(async () => {
  throw new Error("products.list is not implemented yet");
});

const productGetProcedure = protectedProcedure.query(async () => {
  throw new Error("products.get is not implemented yet");
});

const productMutationProcedure = brandRequiredProcedure.mutation(async () => {
  throw new Error("product mutation is not implemented yet");
});

export const productsRouter = createTRPCRouter({
  list: productListProcedure,
  get: productGetProcedure,
  create: productMutationProcedure,
  update: productMutationProcedure,
  delete: productMutationProcedure,
  variants: productVariantsRouter,
  attributes: productAttributesRouter,
});

export type ProductsRouter = typeof productsRouter;
