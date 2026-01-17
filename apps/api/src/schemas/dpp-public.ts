/**
 * Validation schemas for public DPP (Digital Product Passport) endpoints.
 *
 * These schemas back the `dppPublic` router for public-facing endpoints
 * that don't require authentication.
 *
 * URL structure: /[brandSlug]/[productHandle]/[variantUpid]/
 */
import { z } from "zod";
import { productHandleSchema, slugSchema } from "./_shared/primitives.js";
import { upidSchema } from "./products.js";

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

export type DppGetByProductHandleInput = z.infer<
  typeof dppGetByProductHandleSchema
>;
export type DppGetByVariantUpidInput = z.infer<
  typeof dppGetByVariantUpidSchema
>;
export type DppThemePreviewInput = z.infer<typeof dppThemePreviewSchema>;
