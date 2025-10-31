/**
 * Router for managing product passport templates.
 *
 * Brands can enable or disable specific modules that appear in generated
 * passports; these procedures coordinate those toggles.
 */
import { disableTemplateModules, enableTemplateModules } from "@v1/db/queries";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init.js";

const moduleKeySchema = z.enum([
  "core",
  "environment",
  "materials",
  "journey",
  "carousel",
  "cta_banner",
]);

/**
 * Passport template configuration procedures.
 */
export const passportTemplatesRouter = createTRPCRouter({
  /**
   * Enables the requested modules on a template.
   *
   * @param input - Template identifier and module keys to enable.
   * @returns Updated template-module join records.
   */
  enableModules: protectedProcedure
    .input(
      z.object({
        template_id: z.string().uuid(),
        modules: z.array(moduleKeySchema).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      return enableTemplateModules(db, input.template_id, input.modules);
    }),

  /**
   * Disables modules on a template so they no longer render.
   *
   * @param input - Template identifier and module keys to disable.
   * @returns Updated template-module join records.
   */
  disableModules: protectedProcedure
    .input(
      z.object({
        template_id: z.string().uuid(),
        modules: z.array(moduleKeySchema).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      return disableTemplateModules(db, input.template_id, input.modules);
    }),
});
