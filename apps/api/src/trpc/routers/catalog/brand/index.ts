/**
 * Catalog router aggregator for brand-scoped resources.
 */
import { createTRPCRouter } from "@api/trpc/init.ts";
import { certificationsRouter } from "./certifications.js";
import { colorsRouter } from "./colors.js";
import { ecoClaimsRouter } from "./eco-claims.js";
import { facilitiesRouter } from "./facilities.js";
import { materialsRouter } from "./materials.js";
import { showcaseBrandsRouter } from "./showcase-brands.js";
import { sizesRouter } from "./sizes.js";

/**
 * Brand catalog router exposing CRUD endpoints for configurable entities.
 */
export const brandCatalogRouter = createTRPCRouter({
  colors: colorsRouter,
  sizes: sizesRouter,
  materials: materialsRouter,
  certifications: certificationsRouter,
  ecoClaims: ecoClaimsRouter,
  facilities: facilitiesRouter,
  showcaseBrands: showcaseBrandsRouter,
});
