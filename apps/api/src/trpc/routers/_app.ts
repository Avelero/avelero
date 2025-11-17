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
import { passportsRouter } from "./passports/index.js";
import { productsRouter } from "./products/index.js";
import { summaryRouter } from "./summary/index.js";
import { templatesRouter } from "./templates/index.js";
import { userRouter } from "./user/index.js";
import { workflowRouter } from "./workflow/index.js";

/**
 * Main tRPC router containing every API module exposed to clients.
 *
 * Structure (v2 reorganized API):
 * - user: User profile and invites
 * - workflow: Brand lifecycle, members, and invites (renamed from "brand")
 * - brand: Brand catalog (colors, sizes, materials, etc.) (renamed from "brandCatalog")
 * - products: Products and variants
 * - passports: Passport CRUD operations
 * - templates: Passport templates (formerly passports.templates)
 * - summary: Aggregated statistics and completion data
 * - bulk: Centralized bulk operations
 * - composite: Performance-optimized composite endpoints
 * - internal: Internal server-to-server endpoints (protected by API key)
 */
export const appRouter = createTRPCRouter({
  user: userRouter,
  workflow: workflowRouter,
  brand: brandRouter,
  products: productsRouter,
  passports: passportsRouter,
  templates: templatesRouter,
  summary: summaryRouter,
  bulk: bulkRouter,
  composite: compositeRouter,
  internal: internalRouter,
});

/** Convenience alias for the root router's runtime shape. */
export type AppRouter = typeof appRouter;
/** Type helpers used by the front end when interacting with procedures. */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
