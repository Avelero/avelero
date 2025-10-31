/**
 * Catalog router aggregator for brand-agnostic resources.
 */
import { createTRPCRouter } from "@api/trpc/init.ts";
import { careCodesRouter } from "./care-codes.js";
import { categoriesRouter } from "./categories.js";

/**
 * Public catalog lookups shared across all brands.
 */
export const catalogRouter = createTRPCRouter({
  categories: categoriesRouter,
  careCodes: careCodesRouter,
});
