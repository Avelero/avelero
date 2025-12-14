/**
 * Validation schemas for public DPP (Digital Product Passport) endpoints.
 *
 * These schemas back the `dppPublic` router for public-facing endpoints
 * that don't require authentication.
 * 
 * URL structure: /[brandSlug]/[productHandle]/[variantUpid]/
 */
import { z } from "zod";
import { slugSchema } from "./_shared/primitives.js";
import { upidSchema } from "./products.js";

/**
 * Product handle schema: brand-defined identifier used in URL
 */
const productHandleSchema = z
  .string()
  .min(1, "Product handle is required")
  .max(255, "Product handle too long");

/**
 * Input for fetching DPP by product handle.
 * URL: /[brandSlug]/[productHandle]/
 */
export const dppGetByProductHandleSchema = z.object({
  brandSlug: slugSchema,
  productHandle: productHandleSchema,
});

/**
 * Input for fetching DPP by variant UPID.
 * URL: /[brandSlug]/[productHandle]/[variantUpid]/
 */
export const dppGetByVariantUpidSchema = z.object({
  brandSlug: slugSchema,
  productHandle: productHandleSchema,
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
  productHandle: productHandleSchema,
  limit: z.number().min(1).max(20).default(8),
});

export type DppGetByProductHandleInput = z.infer<typeof dppGetByProductHandleSchema>;
export type DppGetByVariantUpidInput = z.infer<typeof dppGetByVariantUpidSchema>;
export type DppThemePreviewInput = z.infer<typeof dppThemePreviewSchema>;
export type DppCarouselListInput = z.infer<typeof dppCarouselListSchema>;

