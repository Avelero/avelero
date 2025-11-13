/**
 * Validation schemas for brand season operations.
 */
import { z } from "zod";
import { byIdSchema, updateWithNullable } from "../_shared/patterns.js";
import { shortStringSchema } from "../_shared/primitives.js";

/**
 * Empty input for listing seasons - no filters needed.
 */
export const listSeasonsSchema = z.object({});

/**
 * Payload for creating a season entry.
 */
export const createSeasonSchema = z.object({
  name: shortStringSchema,
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .optional(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .optional(),
  ongoing: z.boolean().default(false),
});

/**
 * Payload for updating a season entry.
 */
export const updateSeasonSchema = updateWithNullable(createSeasonSchema, [
  "start_date",
  "end_date",
]);

/**
 * Payload for deleting a season entry.
 */
export const deleteSeasonSchema = byIdSchema;
