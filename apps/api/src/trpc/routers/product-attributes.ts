import {
  setProductCareCodes,
  setProductEcoClaims,
  setProductJourneySteps,
  upsertProductEnvironment,
  upsertProductMaterials,
} from "@v1/db/queries";
import {
  setCareCodesSchema,
  setEcoClaimsSchema,
  setJourneyStepsSchema,
  upsertEnvironmentSchema,
  upsertMaterialsSchema,
} from "../../schemas/product-attributes.js";
import { createTRPCRouter, protectedProcedure } from "../init.js";

export const productAttributesRouter = createTRPCRouter({
  materials: {
    set: protectedProcedure
      .input(upsertMaterialsSchema)
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;
        return upsertProductMaterials(
          db,
          input.product_id,
          input.items.map((i) => ({
            brandMaterialId: i.brand_material_id,
            percentage: i.percentage,
          })),
        );
      }),
  },
  careCodes: {
    set: protectedProcedure
      .input(setCareCodesSchema)
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;
        return setProductCareCodes(db, input.product_id, input.care_code_ids);
      }),
  },
  ecoClaims: {
    set: protectedProcedure
      .input(setEcoClaimsSchema)
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;
        return setProductEcoClaims(db, input.product_id, input.eco_claim_ids);
      }),
  },
  environment: {
    upsert: protectedProcedure
      .input(upsertEnvironmentSchema)
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;
        return upsertProductEnvironment(db, input.product_id, {
          carbonKgCo2e: input.carbon_kg_co2e,
          waterLiters: input.water_liters,
        });
      }),
  },
  journey: {
    setSteps: protectedProcedure
      .input(setJourneyStepsSchema)
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;
        return setProductJourneySteps(
          db,
          input.product_id,
          input.steps.map((s) => ({
            sortIndex: s.sort_index,
            stepType: s.step_type,
            facilityId: s.facility_id,
          })),
        );
      }),
  },
});
