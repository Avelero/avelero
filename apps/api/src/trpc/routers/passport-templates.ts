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

export const passportTemplatesRouter = createTRPCRouter({
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
