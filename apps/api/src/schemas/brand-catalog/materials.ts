/**
 * Validation schemas for brand material operations.
 */
import { z } from "zod";
import { byIdSchema, updateWithNullable, voidSchema } from "../_shared/patterns.js";
import {
  countryCodeSchema,
  shortStringSchema,
  uuidSchema,
} from "../_shared/primitives.js";

/**
 * Empty payload for listing brand materials.
 */
export const listMaterialsSchema = voidSchema;

/**
 * Payload for creating a material entry.
 */
export const createMaterialSchema = z.object({
  name: shortStringSchema,
  certification_id: uuidSchema.optional(),
  recyclable: z.boolean().optional(),
  country_of_origin: countryCodeSchema.optional(),
});

/**
 * Payload for updating a material entry.
 */
export const updateMaterialSchema = updateWithNullable(createMaterialSchema, [
  "certification_id",
  "recyclable",
  "country_of_origin",
]);

/**
 * Payload for deleting a material entry.
 */
export const deleteMaterialSchema = byIdSchema;
