import { z } from "zod";

export const upsertMaterialsSchema = z.object({
  product_id: z.string().uuid(),
  items: z
    .array(
      z.object({
        brand_material_id: z.string().uuid(),
        percentage: z.number().min(0).max(100).optional(),
      }),
    )
    .min(1),
});

export const setCareCodesSchema = z.object({
  product_id: z.string().uuid(),
  care_code_ids: z.array(z.string().uuid()).default([]),
});

export const setEcoClaimsSchema = z.object({
  product_id: z.string().uuid(),
  eco_claim_ids: z.array(z.string().uuid()).default([]),
});

export const upsertEnvironmentSchema = z.object({
  product_id: z.string().uuid(),
  carbon_kg_co2e: z.string().optional(),
  water_liters: z.string().optional(),
});

export const setJourneyStepsSchema = z.object({
  product_id: z.string().uuid(),
  steps: z
    .array(
      z.object({
        sort_index: z.number().int().min(0),
        step_type: z.string().min(1),
        facility_id: z.string().uuid(),
      }),
    )
    .default([]),
});

