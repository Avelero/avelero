/**
 * Theme router for workflow domain.
 *
 * Handles theme configuration (content) and theme styles operations.
 * - workflow.theme.get - Get full theme (styles + config)
 * - workflow.theme.updateConfig - Update theme config (menus, banner, social, etc.)
 */
import {
  getBrandTheme,
  updateBrandThemeConfig,
} from "@v1/db/queries";
import { z } from "zod";
import { wrapError } from "../../../utils/errors.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";

/**
 * Get theme data (styles and config) for the active brand.
 */
const getThemeProcedure = brandRequiredProcedure.query(async ({ ctx }) => {
  const { db, brandId } = ctx;
  try {
    const theme = await getBrandTheme(db, brandId);
    if (!theme) {
      return {
        themeStyles: {},
        themeConfig: {},
        updatedAt: null,
      };
    }
    return {
      themeStyles: theme.themeStyles,
      themeConfig: theme.themeConfig,
      updatedAt: theme.updatedAt,
    };
  } catch (error) {
    throw wrapError(error, "Failed to fetch theme");
  }
});

/**
 * Update theme config (content) for the active brand.
 * This updates menus, banner, social links, section visibility, etc.
 */
const updateConfigProcedure = brandRequiredProcedure
  .input(
    z.object({
      // ThemeConfig is validated on the client side
      // Here we accept any object and store it as JSONB
      config: z.record(z.unknown()),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const { db, brandId } = ctx;
    try {
      const result = await updateBrandThemeConfig(db, brandId, input.config);
      return result;
    } catch (error) {
      throw wrapError(error, "Failed to update theme config");
    }
  });

export const workflowThemeRouter = createTRPCRouter({
  get: getThemeProcedure,
  updateConfig: updateConfigProcedure,
});

export type WorkflowThemeRouter = typeof workflowThemeRouter;

