/**
 * Validation schemas for public DPP (Digital Product Passport) endpoints.
 *
 * These schemas back the `dppPublic` router for public-facing endpoints
 * that don't require authentication.
 */
import { z } from "zod";
import { slugSchema } from "./_shared/primitives.js";
import { upidSchema } from "./products.js";

/**
 * Input for fetching DPP by product UPID.
 */
export const dppGetByProductUpidSchema = z.object({
  brandSlug: slugSchema,
  productUpid: upidSchema,
});

/**
 * Input for fetching DPP by variant UPID.
 */
export const dppGetByVariantUpidSchema = z.object({
  brandSlug: slugSchema,
  productUpid: upidSchema,
  variantUpid: upidSchema,
});

/**
 * Input for fetching theme preview data (for screenshot generation).
 */
export const dppThemePreviewSchema = z.object({
  brandSlug: slugSchema,
});

/**
 * Input for fetching carousel products for public DPP display.
 */
export const dppCarouselListSchema = z.object({
  brandSlug: slugSchema,
  productUpid: upidSchema,
  limit: z.number().min(1).max(20).default(8),
});

export type DppGetByProductUpidInput = z.infer<typeof dppGetByProductUpidSchema>;
export type DppGetByVariantUpidInput = z.infer<typeof dppGetByVariantUpidSchema>;
export type DppThemePreviewInput = z.infer<typeof dppThemePreviewSchema>;
export type DppCarouselListInput = z.infer<typeof dppCarouselListSchema>;

