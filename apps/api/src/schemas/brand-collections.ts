/**
 * Brand collections validation schemas.
 *
 * Collections are saved product filter presets that users can create
 * to quickly access commonly used filter configurations.
 *
 * @module schemas/brand-collections
 */
import { z } from "zod";
import { byIdSchema } from "./_shared/patterns.js";
import {
  mediumStringSchema,
  shortStringSchema,
  uuidSchema,
} from "./_shared/primitives.js";

/**
 * Schema for creating a new collection.
 * The filter is stored as JSONB and represents a FilterState structure.
 */
export const collectionCreateSchema = z.object({
  name: shortStringSchema,
  description: mediumStringSchema.optional(),
  filter: z.record(z.unknown()), // FilterState structure stored as JSONB
});

/**
 * Schema for updating an existing collection.
 * All fields are optional except the id.
 */
export const collectionUpdateSchema = z.object({
  id: uuidSchema,
  name: shortStringSchema.optional(),
  description: mediumStringSchema.optional().nullable(),
  filter: z.record(z.unknown()).optional(),
});

/**
 * Schema for listing collections (no input required).
 */
export const collectionListSchema = z.void();

/**
 * Schema for deleting a collection.
 */
export const collectionDeleteSchema = byIdSchema;

// Type exports
export type CollectionCreateInput = z.infer<typeof collectionCreateSchema>;
export type CollectionUpdateInput = z.infer<typeof collectionUpdateSchema>;
export type CollectionDeleteInput = z.infer<typeof collectionDeleteSchema>;

