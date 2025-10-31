/**
 * Brand catalog router scaffold.
 *
 * Covers the nested collections that were previously under `brandCatalog.*`
 * (colors, sizes, materials, facilities, operators, ecoClaims, certifications).
 */
import {
  brandRequiredProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "../../../init.js";

const placeholderList = protectedProcedure.query(async () => {
  throw new Error("brand catalog query not implemented yet");
});

const placeholderMutation = brandRequiredProcedure.mutation(async () => {
  throw new Error("brand catalog mutation not implemented yet");
});

function createCatalogResourceRouter() {
  return createTRPCRouter({
    list: placeholderList,
    create: placeholderMutation,
    update: placeholderMutation,
    delete: placeholderMutation,
  });
}

export const brandRouter = createTRPCRouter({
  colors: createCatalogResourceRouter(),
  sizes: createCatalogResourceRouter(),
  materials: createCatalogResourceRouter(),
  facilities: createCatalogResourceRouter(),
  operators: createCatalogResourceRouter(),
  ecoClaims: createCatalogResourceRouter(),
  certifications: createCatalogResourceRouter(),
});

export type BrandRouter = typeof brandRouter;
