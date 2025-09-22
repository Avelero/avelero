import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { createTRPCRouter } from "../init.js";
import { brandCatalogRouter } from "./brand-catalog.js";
import { brandRouter } from "./brand.js";
import { catalogRouter } from "./catalog.js";
import { importsRouter } from "./imports.js";
import { productAttributesRouter } from "./product-attributes.js";
import { productsRouter } from "./products.js";
import { userRouter } from "./user.js";

export const appRouter = createTRPCRouter({
  brand: brandRouter,
  user: userRouter,
  catalog: catalogRouter,
  brandCatalog: brandCatalogRouter,
  products: productsRouter,
  productAttributes: productAttributesRouter,
  imports: importsRouter,
});

export type AppRouter = typeof appRouter;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
