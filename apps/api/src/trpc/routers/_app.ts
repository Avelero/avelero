/**
 * Aggregates all tRPC routers for the API surface.
 *
 * Each domain-specific router is composed into this root router so the client
 * and server can share a single set of type-safe endpoints.
 */
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { createTRPCRouter } from "../init.js";
import { brandRouter } from "./brand/index.js";
import { brandCatalogRouter, catalogRouter } from "./catalog/index.js";
import { passportTemplatesRouter } from "./passport-templates.js";
import { passportsRouter } from "./passports.js";
import {
  importsRouter,
  productAttributesRouter,
  productsRouter,
} from "./products/index.js";
import { userRouter } from "./user.js";
import { apiV2Router } from "./v2/index.js";

/**
 * Main tRPC router containing every API module exposed to clients.
 */
export const appRouter = createTRPCRouter({
  brand: brandRouter,
  user: userRouter,
  catalog: catalogRouter,
  brandCatalog: brandCatalogRouter,
  products: productsRouter,
  productAttributes: productAttributesRouter,
  imports: importsRouter,
  passports: passportsRouter,
  passportTemplates: passportTemplatesRouter,
  v2: apiV2Router,
});

/** Convenience alias for the root router's runtime shape. */
export type AppRouter = typeof appRouter;
/** Type helpers used by the front end when interacting with procedures. */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
