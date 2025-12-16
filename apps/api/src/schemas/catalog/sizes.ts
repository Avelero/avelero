/**
 * Validation schemas for brand size operations.
 */
import { z } from "zod";
import { byIdSchema, updateWithNullable } from "../_shared/patterns.js";
import {
  intSchema,
  shortStringSchema,
} from "../_shared/primitives.js";

/**
 * Optional filters when listing sizes.
 * No filters needed - sizes are now a flat list per brand.
 */
export const listSizesSchema = z.object({});

/**
 * Payload for creating a size entry.
 */
export const createSizeSchema = z.object({
  name: shortStringSchema,
});

/**
 * Payload for updating a size entry.
 */
export const updateSizeSchema = updateWithNullable(createSizeSchema, []);

/**
 * Payload for deleting a size entry.
 */
export const deleteSizeSchema = byIdSchema;
