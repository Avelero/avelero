/**
 * Product attribute writers scaffold.
 *
 * Targets:
 * - products.attributes.materials.set
 * - products.attributes.careCodes.set
 * - products.attributes.ecoClaims.set
 * - products.attributes.environment.upsert
 * - products.attributes.journey.setSteps
 */
import {
  brandRequiredProcedure,
  createTRPCRouter,
} from "../../../../init.js";

const replaceCollection = brandRequiredProcedure.mutation(async () => {
  throw new Error("product attribute collection update not implemented yet");
});

const upsertEnvironment = brandRequiredProcedure.mutation(async () => {
  throw new Error("product environment upsert not implemented yet");
});

export const productAttributesRouter = createTRPCRouter({
  materials: createTRPCRouter({
    set: replaceCollection,
  }),
  careCodes: createTRPCRouter({
    set: replaceCollection,
  }),
  ecoClaims: createTRPCRouter({
    set: replaceCollection,
  }),
  environment: createTRPCRouter({
    upsert: upsertEnvironment,
  }),
  journey: createTRPCRouter({
    setSteps: replaceCollection,
  }),
});

export type ProductAttributesRouter = typeof productAttributesRouter;
