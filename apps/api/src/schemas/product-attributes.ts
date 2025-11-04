/**
 * Validation schemas for product enrichment attributes.
 *
 * These definitions ensure product-related mutations receive correctly shaped
 * payloads when managing materials, care codes, eco claims, and journey steps.
 */
import { z } from "zod";
import {
  nonNegativeIntSchema,
  percentageSchema,
  shortStringSchema,
  uuidArraySchema,
  uuidSchema,
} from "./_shared/primitives.js";

/**
 * Payload for replacing a product's material composition.
 */
export const upsertMaterialsSchema = z.object({
  product_id: uuidSchema,
  items: z
    .array(
      z.object({
        brand_material_id: uuidSchema,
        percentage: percentageSchema.optional(),
      }),
    )
    .min(1),
});

/**
 * Payload for saving the set of care codes on a product.
 */
export const setCareCodesSchema = z.object({
  product_id: uuidSchema,
  care_code_ids: uuidArraySchema.default([]),
});

/**
 * Payload for saving eco claim associations.
 */
export const setEcoClaimsSchema = z.object({
  product_id: uuidSchema,
  eco_claim_ids: uuidArraySchema.default([]),
});

/**
 * Payload for recording environmental impact metrics.
 */
export const upsertEnvironmentSchema = z.object({
  product_id: uuidSchema,
  carbon_kg_co2e: z.string().optional(),
  water_liters: z.string().optional(),
});

/**
 * Payload for defining the ordered production journey steps.
 */
export const setJourneyStepsSchema = z.object({
  product_id: uuidSchema,
  steps: z
    .array(
      z.object({
        sort_index: nonNegativeIntSchema,
        step_type: shortStringSchema,
        facility_id: uuidSchema,
      }),
    )
    .default([]),
});
