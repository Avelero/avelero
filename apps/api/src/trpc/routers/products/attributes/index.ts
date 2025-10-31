/**
 * Product attribute management router.
 *
 * Keeps product enrichments (materials, care, eco claims, etc.) in sync with
 * the database while hiding Drizzle-specific payload shapes.
 */
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
} from "@api/schemas/index.ts";
import { createTRPCRouter, protectedProcedure } from "@api/trpc/init.ts";

/**
 * Router exposing attribute upsert operations for products.
 */
export const productAttributesRouter = createTRPCRouter({
  /**
   * Material composition helpers for products.
   */
  materials: {
    /**
     * Replaces the list of materials tied to a product.
     *
     * @param input - Product id and new material breakdown.
     * @returns Updated material records.
     */
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
    /**
     * Saves the set of care codes associated with a product.
     *
     * @param input - Product id plus the selected care code ids.
     * @returns Result of the persistence operation.
     */
    set: protectedProcedure
      .input(setCareCodesSchema)
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;
        return setProductCareCodes(db, input.product_id, input.care_code_ids);
      }),
  },
  ecoClaims: {
    /**
     * Persists eco-claim tags for a product.
     *
     * @param input - Product id and eco claim ids to assign.
     * @returns Result of the persistence operation.
     */
    set: protectedProcedure
      .input(setEcoClaimsSchema)
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;
        return setProductEcoClaims(db, input.product_id, input.eco_claim_ids);
      }),
  },
  environment: {
    /**
     * Upserts environment impact metrics for a product.
     *
     * @param input - Product id and impact measurements.
     * @returns Result of the upsert operation.
     */
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
    /**
     * Overrides the product journey steps used in passports.
     *
     * @param input - Product id and ordered journey steps.
     * @returns Result of the persistence operation.
     */
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
