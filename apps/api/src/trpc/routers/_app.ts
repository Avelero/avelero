/**
 * Aggregates all tRPC routers for the API surface.
 *
 * Each domain-specific router is composed into this root router so the client
 * and server can share a single set of type-safe endpoints.
 *
 * Phase 4 changes:
 * - Renamed `workflow` → `brand` (brand lifecycle)
 * - Renamed `brand` → `catalog` (catalog entities)
 * - Added collections to brand router
 */
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { createTRPCRouter } from "../init.js";
import { brandRouter } from "./brand/index.js";
import { bulkRouter } from "./bulk/index.js";
import { catalogRouter } from "./catalog/index.js";
import { compositeRouter } from "./composite/index.js";
import { dppPublicRouter } from "./dpp-public/index.js";
import { integrationsRouter } from "./integrations/index.js";
import { internalRouter } from "./internal/index.js";
import { productsRouter } from "./products/index.js";
import { summaryRouter } from "./summary/index.js";
import { taxonomyRouter } from "./taxonomy/index.js";
import { userRouter } from "./user/index.js";

/**
 * Main tRPC router containing every API module exposed to clients.
 *
 * Structure (reorganized API - Phase 4):
 * - user: User profile, invites (accept/reject), and brand management (list/create/leave)
 * - brand: Brand lifecycle (update/delete), members, invites (send/revoke), theme, collections
 * - catalog: Brand catalog entities (attributes, colors, sizes, materials, etc.)
 * - taxonomy: Global read-only taxonomy data (attributes, values)
 * - products: Products, variants, and attributes
 * - bulk: Centralized bulk operations
 * - composite: Performance-optimized composite endpoints
 * - summary: Aggregated stats endpoints
 * - integrations: Integration management (connect, sync, mappings)
 * - internal: Internal server-to-server endpoints (protected by API key)
 * - dppPublic: Public DPP (Digital Product Passport) endpoints (no auth required)
 */
export const appRouter = createTRPCRouter({
  user: userRouter,
  brand: brandRouter,
  catalog: catalogRouter,
  taxonomy: taxonomyRouter,
  products: productsRouter,
  bulk: bulkRouter,
  composite: compositeRouter,
  summary: summaryRouter,
  integrations: integrationsRouter,
  internal: internalRouter,
  dppPublic: dppPublicRouter,
});

/** Convenience alias for the root router's runtime shape. */
export type AppRouter = typeof appRouter;
/** Type helpers used by the front end when interacting with procedures. */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
