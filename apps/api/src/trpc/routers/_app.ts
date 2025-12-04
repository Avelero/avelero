/**
 * Aggregates all tRPC routers for the API surface.
 *
 * Each domain-specific router is composed into this root router so the client
 * and server can share a single set of type-safe endpoints.
 *
 * This uses the reorganized v2 API structure as defined in docs/NEW_API_ENDPOINTS.txt.
 */
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { createTRPCRouter } from "../init.js";
import { brandRouter } from "./brand/index.js";
import { bulkRouter } from "./bulk/index.js";
import { compositeRouter } from "./composite/index.js";
import { internalRouter } from "./internal/index.js";
import { templatesRouter } from "./templates/index.js";
import { productsRouter } from "./products/index.js";
import { summaryRouter } from "./summary/index.js";
import { userRouter } from "./user/index.js";
import { workflowRouter } from "./workflow/index.js";
import { dppPublicRouter } from "./dpp-public/index.js";

/**
 * Main tRPC router containing every API module exposed to clients.
 *
 * Structure (v2 reorganized API):
 * - user: User profile and invites
 * - workflow: Brand lifecycle, members, and invites (renamed from "brand")
 * - brand: Brand catalog (colors, sizes, materials, etc.) (renamed from "brandCatalog")
 * - products: Products, variants, and attributes
 * - templates: Passport templates management
 * - bulk: Centralized bulk operations
 * - composite: Performance-optimized composite endpoints
 * - summary: Aggregated stats endpoints
 * - internal: Internal server-to-server endpoints (protected by API key)
 * - dppPublic: Public DPP (Digital Product Passport) endpoints (no auth required)
 */
export const appRouter = createTRPCRouter({
  user: userRouter,
  workflow: workflowRouter,
  brand: brandRouter,
  products: productsRouter,
  templates: templatesRouter,
  bulk: bulkRouter,
  composite: compositeRouter,
  summary: summaryRouter,
  internal: internalRouter,
  dppPublic: dppPublicRouter,
});

/** Convenience alias for the root router's runtime shape. */
export type AppRouter = typeof appRouter;
/** Type helpers used by the front end when interacting with procedures. */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
