import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { createTRPCRouter } from "../init.js";
import { brandCatalogRouter } from "./brand-catalog.js";
import { brandRouter } from "./brand.js";
import { catalogRouter } from "./catalog.js";
import { categoriesRouter } from "./categories.js";
import { importsRouter } from "./imports.js";
import { modulesRouter } from "./modules.js";
import { passportsRouter } from "./passports.js";
import { productAttributesRouter } from "./product-attributes.js";
import { productsRouter } from "./products.js";
import { templatesRouter } from "./templates.js";
import { userRouter } from "./user.js";
import { variantsRouter } from "./variants.js";
import { analyticsRouter } from "./analytics.js";

export const appRouter = createTRPCRouter({
  brand: brandRouter,
  user: userRouter,
  catalog: catalogRouter,
  brandCatalog: brandCatalogRouter,
  categories: categoriesRouter,
  products: productsRouter,
  variants: variantsRouter,
  passports: passportsRouter,
  templates: templatesRouter,
  modules: modulesRouter,
  productAttributes: productAttributesRouter,
  imports: importsRouter,
  analytics: analyticsRouter,
});

export type AppRouter = typeof appRouter;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
