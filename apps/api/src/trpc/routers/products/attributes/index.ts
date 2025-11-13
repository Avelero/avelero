import type { Database } from "@v1/db/client";
import {
  and,
  eq,
  setProductCareCodes,
  setProductEcoClaims,
  setProductJourneySteps,
  upsertProductEnvironment,
  upsertProductMaterials,
} from "@v1/db/queries";
import { products } from "@v1/db/schema";
/**
 * Product attribute management router.
 *
 * Provides replace-all semantics for join-table attributes (materials, care
 * codes, eco claims, journey) and an environment metrics upsert endpoint.
 */
import {
  setCareCodesSchema,
  setEcoClaimsSchema,
  setJourneyStepsSchema,
  upsertEnvironmentSchema,
  upsertMaterialsSchema,
} from "../../../../schemas/product-attributes.js";
import { badRequest, wrapError } from "../../../../utils/errors.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../../init.js";

async function assertProductForBrand(
  db: Database,
  brandId: string,
  productId: string,
) {
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.brandId, brandId)))
    .limit(1);
  if (!rows[0]) {
    throw badRequest("Product not found for the active brand");
  }
}

export const productAttributesRouter = createTRPCRouter({
  materials: createTRPCRouter({
    set: brandRequiredProcedure
      .input(upsertMaterialsSchema)
      .mutation(async ({ ctx, input }) => {
        const { db, brandId } = ctx;
        const activeBrandId = brandId as string;
        await assertProductForBrand(db, activeBrandId, input.product_id);

        try {
          return await upsertProductMaterials(
            db,
            input.product_id,
            input.items.map((item) => ({
              brandMaterialId: item.brand_material_id,
              percentage: item.percentage,
            })),
          );
        } catch (error) {
          throw wrapError(error, "Failed to set product materials");
        }
      }),
  }),
  careCodes: createTRPCRouter({
    set: brandRequiredProcedure
      .input(setCareCodesSchema)
      .mutation(async ({ ctx, input }) => {
        const { db, brandId } = ctx;
        const activeBrandId = brandId as string;
        await assertProductForBrand(db, activeBrandId, input.product_id);

        try {
          return await setProductCareCodes(
            db,
            input.product_id,
            input.care_code_ids,
          );
        } catch (error) {
          throw wrapError(error, "Failed to set product care codes");
        }
      }),
  }),
  ecoClaims: createTRPCRouter({
    set: brandRequiredProcedure
      .input(setEcoClaimsSchema)
      .mutation(async ({ ctx, input }) => {
        const { db, brandId } = ctx;
        const activeBrandId = brandId as string;
        await assertProductForBrand(db, activeBrandId, input.product_id);

        try {
          return await setProductEcoClaims(
            db,
            input.product_id,
            input.eco_claim_ids,
          );
        } catch (error) {
          throw wrapError(error, "Failed to set product eco claims");
        }
      }),
  }),
  environment: createTRPCRouter({
    upsert: brandRequiredProcedure
      .input(upsertEnvironmentSchema)
      .mutation(async ({ ctx, input }) => {
        const { db, brandId } = ctx;
        const activeBrandId = brandId as string;
        await assertProductForBrand(db, activeBrandId, input.product_id);

        try {
          return await upsertProductEnvironment(db, input.product_id, {
            carbonKgCo2e: input.carbon_kg_co2e,
            waterLiters: input.water_liters,
          });
        } catch (error) {
          throw wrapError(error, "Failed to upsert product environment");
        }
      }),
  }),
  journey: createTRPCRouter({
    setSteps: brandRequiredProcedure
      .input(setJourneyStepsSchema)
      .mutation(async ({ ctx, input }) => {
        const { db, brandId } = ctx;
        const activeBrandId = brandId as string;
        await assertProductForBrand(db, activeBrandId, input.product_id);

        try {
          return await setProductJourneySteps(
            db,
            input.product_id,
            input.steps.map((step) => ({
              sortIndex: step.sort_index,
              stepType: step.step_type,
              facilityId: step.facility_id,
            })),
          );
        } catch (error) {
          throw wrapError(error, "Failed to set product journey steps");
        }
      }),
  }),
});

export type ProductAttributesRouter = typeof productAttributesRouter;
