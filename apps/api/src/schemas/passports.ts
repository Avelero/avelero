/**
 * Validation schemas for the passports domain.
 *
 * Defines payload contracts for passport CRUD operations and nested template
 * management, mirroring the API structure described in
 * `docs/NEW_API_ENDPOINTS.txt`.
 */
import { z } from "zod";
import {
  nonNegativeIntSchema,
  shortStringSchema,
  uuidSchema,
} from "./_shared/primitives.js";

/**
 * Enumerates supported passport publication statuses.
 */
export const passportStatusSchema = z.enum([
  "published",
  "scheduled",
  "unpublished",
  "archived",
]);

/**
 * Available module keys for passport templates.
 *
 * Matches the module identifiers found in `packages/db/src/completion/module-keys.ts`.
 */
export const passportModuleKeySchema = z.enum([
  "core",
  "environment",
  "materials",
  "journey",
  "carousel",
  "cta_banner",
]);

/**
 * Filters object placeholder for passport listings.
 *
 * Currently only supports status filtering but is designed to expand as the
 * advanced filter UI is integrated with the backend.
 */
export const passportListFiltersSchema = z
  .object({
    status: z.array(passportStatusSchema).optional(),
  })
  .catchall(z.unknown())
  .optional();

/**
 * Input payload for `passports.list`.
 *
 * Supports simple page-based pagination and optional status count aggregation.
 */
export const passportsListSchema = z.object({
  page: nonNegativeIntSchema.default(0),
  includeStatusCounts: z.boolean().optional().default(false),
  filters: passportListFiltersSchema,
});

export type PassportsListInput = z.infer<typeof passportsListSchema>;

/**
 * Input payload for `passports.get`.
 *
 * Passports are identified by their public UPID slug.
 */
export const passportsGetSchema = z.object({
  upid: shortStringSchema,
});

export type PassportsGetInput = z.infer<typeof passportsGetSchema>;

/**
 * Input payload for `passports.create`.
 *
 * Creates a passport for the provided product + variant combination. The
 * template identifier is optional; when omitted, server-side defaults apply.
 */
export const passportsCreateSchema = z.object({
  product_id: uuidSchema,
  variant_id: uuidSchema,
  template_id: uuidSchema.optional(),
  status: passportStatusSchema.optional(),
});

export type PassportsCreateInput = z.infer<typeof passportsCreateSchema>;

/**
 * Input payload for `passports.update`.
 *
 * Only the status and template may be updated. Validation ensures at least
 * one field is provided.
 */
export const passportsUpdateSchema = z
  .object({
    upid: shortStringSchema,
    status: passportStatusSchema.optional(),
    template_id: uuidSchema.optional(),
  })
  .refine(
    (value) => value.status !== undefined || value.template_id !== undefined,
    {
      message: "Provide status or template_id to update the passport.",
      path: ["status"],
    },
  );

export type PassportsUpdateInput = z.infer<typeof passportsUpdateSchema>;

/**
 * Input payload for `passports.delete`.
 */
export const passportsDeleteSchema = z.object({
  upid: shortStringSchema,
});

export type PassportsDeleteInput = z.infer<typeof passportsDeleteSchema>;

/**
 * Input payload for `passports.templates.list`.
 *
 * Accepts an optional `brand_id` to scope the listing when acting on behalf
 * of another brand. Omitted defaults to the caller's active brand context.
 */
export const passportTemplatesListSchema = z.object({
  brand_id: uuidSchema.optional(),
});

export type PassportTemplatesListInput = z.infer<
  typeof passportTemplatesListSchema
>;

/**
 * Input payload for `passports.templates.get`.
 */
export const passportTemplatesGetSchema = z.object({
  id: uuidSchema,
});

export type PassportTemplatesGetInput = z.infer<
  typeof passportTemplatesGetSchema
>;

/**
 * Module configuration payload shared by create/update template mutations.
 */
export const passportTemplateModuleSchema = z.object({
  module_key: passportModuleKeySchema,
  enabled: z.boolean().optional().default(true),
  sort_index: nonNegativeIntSchema.default(0),
});

/**
 * Input payload for `passports.templates.create`.
 *
 * Creates a template with optional theme and module configuration. Modules
 * are treated as replace-all semantics relative to the empty baseline.
 */
export const passportTemplatesCreateSchema = z.object({
  brand_id: uuidSchema,
  name: shortStringSchema,
  theme: z.record(z.string(), z.unknown()).optional(),
  modules: z.array(passportTemplateModuleSchema).optional(),
});

export type PassportTemplatesCreateInput = z.infer<
  typeof passportTemplatesCreateSchema
>;

/**
 * Input payload for `passports.templates.update`.
 *
 * Allows partial updates to name/theme and optional module replacement.
 */
export const passportTemplatesUpdateSchema = z
  .object({
    id: uuidSchema,
    name: shortStringSchema.optional(),
    theme: z.record(z.string(), z.unknown()).optional(),
    modules: z.array(passportTemplateModuleSchema).optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.theme !== undefined ||
      value.modules !== undefined,
    {
      message: "Provide name, theme, or modules to update the template.",
      path: ["name"],
    },
  );

export type PassportTemplatesUpdateInput = z.infer<
  typeof passportTemplatesUpdateSchema
>;

/**
 * Input payload for `passports.templates.delete`.
 */
export const passportTemplatesDeleteSchema = z.object({
  id: uuidSchema,
});

export type PassportTemplatesDeleteInput = z.infer<
  typeof passportTemplatesDeleteSchema
>;
