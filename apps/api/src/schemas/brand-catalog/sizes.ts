/**
 * Validation schemas for brand size operations.
 */
import { z } from "zod";
import { byIdSchema, updateWithNullable } from "../_shared/patterns.js";
import {
  intSchema,
  shortStringSchema,
  uuidSchema,
} from "../_shared/primitives.js";

/**
 * Optional filters when listing sizes.
 */
export const listSizesSchema = z.object({
  category_id: uuidSchema.optional(),
});

/**
 * Payload for creating a size entry.
 */
export const createSizeSchema = z.object({
  name: shortStringSchema,
  category_id: uuidSchema.optional(),
  sort_index: intSchema.optional(),
});

/**
 * Payload for updating a size entry.
 */
export const updateSizeSchema = updateWithNullable(createSizeSchema, [
  "category_id",
  "sort_index",
]);

/**
 * Payload for deleting a size entry.
 */
export const deleteSizeSchema = byIdSchema;
