/**
 * Validation schemas for brand attribute value operations.
 *
 * Brand attribute values are the selectable options within a dimension
 * (e.g., "Red", "Blue" for Color; "S", "M", "L" for Size).
 * Values can optionally link to taxonomy values for semantic meaning.
 */
import { z } from "zod";
import { byIdSchema, byParentId, updateFrom } from "../_shared/patterns.js";
import { shortStringSchema, uuidSchema } from "../_shared/primitives.js";

/**
 * Payload for listing brand attribute values.
 * Requires the parent attribute_id.
 */
export const listBrandAttributeValuesSchema = byParentId("attribute_id");

/**
 * Payload for creating a brand attribute value.
 */
export const createBrandAttributeValueSchema = z.object({
  attribute_id: uuidSchema,
  name: shortStringSchema,
  taxonomy_value_id: uuidSchema.optional().nullable(),
});

/**
 * Payload for updating a brand attribute value.
 */
export const updateBrandAttributeValueSchema = updateFrom(
  createBrandAttributeValueSchema
);

/**
 * Payload for deleting a brand attribute value by id.
 */
export const deleteBrandAttributeValueSchema = byIdSchema;

/**
 * Payload for batch creating brand attribute values.
 * Useful for creating multiple values in one request during variant setup.
 */
export const batchCreateBrandAttributeValuesSchema = z.object({
  values: z.array(createBrandAttributeValueSchema).min(1).max(100, "Maximum 100 values per batch"),
});
