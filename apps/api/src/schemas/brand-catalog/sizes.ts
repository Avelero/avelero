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
 * Valid category group values for size organization.
 * Format: "gender-subgroup" (e.g., "mens-tops", "womens-bottoms")
 */
export const categoryGroupSchema = z.enum([
  "mens-tops",
  "mens-bottoms",
  "mens-outerwear",
  "mens-footwear",
  "mens-accessories",
  "womens-tops",
  "womens-bottoms",
  "womens-dresses",
  "womens-outerwear",
  "womens-footwear",
  "womens-accessories",
]);

/**
 * Optional filters when listing sizes.
 * Supports both new categoryGroup (preferred) and legacy categoryId filtering.
 */
export const listSizesSchema = z.object({
  category_group: categoryGroupSchema.optional(),
  category_id: uuidSchema.optional(),
});

/**
 * Payload for creating a size entry.
 * New implementations should use category_group.
 */
export const createSizeSchema = z.object({
  name: shortStringSchema,
  category_group: categoryGroupSchema.optional(),
  category_id: uuidSchema.optional(), // Legacy support
  sort_index: intSchema.optional(),
});

/**
 * Payload for updating a size entry.
 */
export const updateSizeSchema = updateWithNullable(createSizeSchema, [
  "category_group",
  "category_id",
  "sort_index",
]);

/**
 * Payload for deleting a size entry.
 */
export const deleteSizeSchema = byIdSchema;
