import { z } from "zod";
import {
  nonNegativeIntSchema,
  shortStringSchema,
  uuidSchema,
} from "./_shared/primitives.js";

/**
 * Template module keys mirror the enum used in the database.
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
 * Template module payload shared by create/update operations.
 *
 * Reflects the `passport_template_modules` table shape.
 */
export const passportTemplateModuleSchema = z.object({
  module_key: passportModuleKeySchema,
  enabled: z.boolean().optional().default(true),
  sort_index: nonNegativeIntSchema.default(0),
});

/**
 * Input payload for listing templates. Matches `passport_templates.brand_id`.
 */
export const passportTemplatesListSchema = z.object({
  brand_id: uuidSchema.optional(),
});

export type PassportTemplatesListInput = z.infer<
  typeof passportTemplatesListSchema
>;

/**
 * Input payload for fetching a single template.
 */
export const passportTemplatesGetSchema = z.object({
  id: uuidSchema,
});

export type PassportTemplatesGetInput = z.infer<
  typeof passportTemplatesGetSchema
>;

/**
 * Input payload for creating a template.
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
 * Input payload for updating a template.
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
 * Input payload for deleting a template.
 */
export const passportTemplatesDeleteSchema = z.object({
  id: uuidSchema,
});

export type PassportTemplatesDeleteInput = z.infer<
  typeof passportTemplatesDeleteSchema
>;

