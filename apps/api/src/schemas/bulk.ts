/**
 * Validation schemas for centralized bulk operations.
 *
 * These schemas back the `bulk.*` domain in the v2 router, ensuring each
 * mutation performs strict input validation before touching the database.
 * Only domain-specific fields are permitted to flow through to the handlers.
 */
import { z } from "zod";
import { uuidArraySchema, uuidSchema } from "./_shared/primitives.js";
import { passportStatusSchema } from "./passports.js";
import { productsDomainCreateSchema } from "./products.js";

/**
 * Common selection strategies supported by bulk mutations.
 *
 * - `mode: "all"`: operate on the full set within the active brand, optionally
 *   excluding a subset of IDs.
 * - `mode: "explicit"`: operate on an explicit list of identifiers.
 */
export const bulkSelectionSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("all"),
    excludeIds: uuidArraySchema.optional(),
  }),
  z.object({
    mode: z.literal("explicit"),
    includeIds: uuidArraySchema.min(1),
  }),
]);

/**
 * Payload structure for importing products in bulk.
 *
 * `domain` is intentionally restricted to `"products"` so the router can
 * dispatch to the appropriate handler without additional guards.
 */
export const bulkImportSchema = z.object({
  brand_id: uuidSchema,
  domain: z.literal("products"),
  items: productsDomainCreateSchema.omit({ brand_id: true }).array().min(1),
});

/**
 * Permitted passport mutations for bulk updates.
 *
 * The schema ensures at least one change is supplied.
 */
export const bulkUpdatePassportsChangesSchema = z
  .object({
    status: passportStatusSchema.optional(),
  })
  .refine((value) => value.status !== undefined, {
    message: "Provide at least one passport field to update.",
    path: ["status"],
  });

/**
 * Placeholder schema for future product bulk updates.
 *
 * The router currently only supports passport updates, but accepting a typed
 * payload keeps the contract forward-compatible.
 */
export const bulkUpdateProductsChangesSchema = z
  .object({})
  .catchall(z.unknown())
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide at least one product field to update.",
        path: [],
      });
    }
  });

/**
 * Placeholder schema for future brand catalog bulk updates.
 *
 * Accepts arbitrary keys for now while requiring a non-empty object.
 */
export const bulkUpdateBrandChangesSchema = z
  .object({})
  .catchall(z.unknown())
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide at least one brand field to update.",
        path: [],
      });
    }
  });

/**
 * Bulk update payload discriminated by domain.
 *
 * Each domain reuses the common selection schema but constrains its `changes`
 * payload to domain-appropriate fields.
 */
export const bulkUpdateSchema = z.discriminatedUnion("domain", [
  z.object({
    domain: z.literal("passports"),
    selection: bulkSelectionSchema,
    changes: bulkUpdatePassportsChangesSchema,
  }),
  z.object({
    domain: z.literal("products"),
    selection: bulkSelectionSchema,
    changes: bulkUpdateProductsChangesSchema,
  }),
  z.object({
    domain: z.literal("brand"),
    selection: bulkSelectionSchema,
    changes: bulkUpdateBrandChangesSchema,
  }),
]);

export type BulkSelectionInput = z.infer<typeof bulkSelectionSchema>;
export type BulkImportInput = z.infer<typeof bulkImportSchema>;
export type BulkUpdateInput = z.infer<typeof bulkUpdateSchema>;
