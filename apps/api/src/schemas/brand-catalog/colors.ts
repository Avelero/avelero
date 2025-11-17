/**
 * Validation schemas for brand color operations.
 */
import { z } from "zod";
import { byIdSchema, updateFrom, voidSchema } from "../_shared/patterns.js";
import { hexColorSchema, shortStringSchema } from "../_shared/primitives.js";

/**
 * Empty payload for listing brand colors.
 */
export const listColorsSchema = voidSchema;

/**
 * Payload for creating a brand color.
 */
export const createColorSchema = z.object({
  name: shortStringSchema,
  hex: hexColorSchema,
});

/**
 * Payload for updating a brand color.
 */
export const updateColorSchema = updateFrom(createColorSchema);

/**
 * Payload for deleting a brand color by id.
 */
export const deleteColorSchema = byIdSchema;
