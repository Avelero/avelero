/**
 * Validation schemas for brand attribute operations.
 *
 * Brand attributes are variant dimensions (e.g., Color, Size, Material)
 * that can optionally link to taxonomy attributes for semantic meaning.
 */
import { z } from "zod";
import { byIdSchema, updateFrom, voidSchema } from "../_shared/patterns.js";
import { shortStringSchema, uuidSchema } from "../_shared/primitives.js";

/**
 * Empty payload for listing brand attributes.
 */
export const listBrandAttributesSchema = voidSchema;

/**
 * Payload for creating a brand attribute.
 */
export const createBrandAttributeSchema = z.object({
  name: shortStringSchema,
  taxonomy_attribute_id: uuidSchema.optional().nullable(),
});

/**
 * Payload for updating a brand attribute.
 */
export const updateBrandAttributeSchema = updateFrom(createBrandAttributeSchema);

/**
 * Payload for deleting a brand attribute by id.
 */
export const deleteBrandAttributeSchema = byIdSchema;

