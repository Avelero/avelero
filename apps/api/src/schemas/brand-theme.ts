/**
 * Validation schemas for brand theme configuration.
 *
 * These schemas back the `brand.theme` endpoints for managing
 * Digital Product Passport (DPP) theming and appearance settings.
 */
import { z } from "zod";

/**
 * Theme configuration stored as flexible JSON.
 * Structure is validated on the client side for UI-specific settings.
 */
export const themeConfigSchema = z.record(z.unknown());

/**
 * Payload for updating theme configuration.
 * Triggers screenshot capture for carousel previews.
 */
export const themeUpdateSchema = z.object({
  config: themeConfigSchema,
});

export type ThemeConfig = z.infer<typeof themeConfigSchema>;
export type ThemeUpdateInput = z.infer<typeof themeUpdateSchema>;
