/**
 * Future-facing API router scaffold.
 *
 * This module wires up the domain-level routers that follow the proposed
 * endpoint structure outlined in docs/NEW_API_ENDPOINTS.txt. Each router is
 * currently a placeholder so that we can implement the new endpoints in
 * incremental phases without disrupting the legacy surface.
 */
import { createTRPCRouter } from "../../init.js";
import { userRouter } from "./user/index.js";
import { workflowRouter } from "./workflow/index.js";
import { brandRouter } from "./brand/index.js";
import { productsRouter } from "./products/index.js";
import { passportsRouter } from "./passports/index.js";
import { bulkRouter } from "./bulk/index.js";
import { compositeRouter } from "./composite/index.js";

/**
 * Router entry point for the reorganized API surface.
 *
 * Nothing is exported to callers yet. Once individual routers are migrated,
 * this entry point can be stitched into `_app.ts`.
 */
export const apiV2Router = createTRPCRouter({
  user: userRouter,
  workflow: workflowRouter,
  brand: brandRouter,
  products: productsRouter,
  passports: passportsRouter,
  bulk: bulkRouter,
  composite: compositeRouter,
});

export type ApiV2Router = typeof apiV2Router;
