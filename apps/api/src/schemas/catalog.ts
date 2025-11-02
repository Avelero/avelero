/**
 * Shared read-only catalog schemas.
 *
 * These light-weight shapes validate simple list operations for common
 * reference data such as categories and care codes.
 */
import { z } from "zod";
import { byIdSchema, voidSchema } from "./_shared/patterns.js";

// Global catalog: categories and care codes (read-only inputs)

/**
 * Empty payload used when listing categories.
 */
export const listCategoriesSchema = voidSchema;
/**
 * Empty payload used when listing care codes.
 */
export const listCareCodesSchema = voidSchema;

/**
 * Schema for accepting a UUID identifier.
 */
export const catalogIdParamSchema = byIdSchema;
