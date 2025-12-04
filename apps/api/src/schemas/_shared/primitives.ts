/**
 * Shared Zod schema primitives.
 *
 * Centralized validation schemas used across all API schemas. This single
 * source of truth ensures consistent validation rules and makes maintenance
 * easier - update once, apply everywhere.
 *
 * @module schemas/_shared/primitives
 */
import { z } from "zod";

// ============================================================================
// String Primitives
// ============================================================================

/**
 * Validates UUID v4 format.
 * @example "550e8400-e29b-41d4-a716-446655440000"
 */
export const uuidSchema = z.string().uuid();

/**
 * Validates non-empty strings (min length 1).
 * Used for required text fields like names, titles, etc.
 * @deprecated Use shortStringSchema, mediumStringSchema, or longStringSchema instead
 */
export const nonEmptyStringSchema = z.string().min(1);

/**
 * Validates short strings (1-100 characters).
 * Use for names, titles, labels, SKUs, and other identifiers.
 * @example "Product Name", "Brand Title", "SKU-12345"
 */
export const shortStringSchema = z.string().min(1).max(100);

/**
 * Validates URL-friendly slugs.
 * Only lowercase letters, numbers, and dashes allowed.
 * Must be 2-50 characters.
 * @example "my-brand", "acme-inc", "brand123"
 */
export const slugSchema = z
  .string()
  .min(2, "Slug must be at least 2 characters")
  .max(50, "Slug must be at most 50 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must contain only lowercase letters, numbers, and dashes (no leading/trailing dashes)",
  );

/**
 * Validates 6-character hexadecimal color values (accepts optional #).
 * Normalizes to uppercase without the # prefix.
 * @example "#FFAA00", "1F2937"
 */
export const hexColorSchema = z
  .string()
  .regex(/^#?[0-9A-Fa-f]{6}$/, "Hex color must be a 6-character value")
  .transform((value) => value.replace("#", "").toUpperCase());

/**
 * Validates medium strings (1-500 characters).
 * Use for short descriptions, summaries, and brief text content.
 * @example "A high-quality sustainable cotton t-shirt made from organic materials."
 */
export const mediumStringSchema = z.string().min(1).max(500);

/**
 * Validates long strings (1-2000 characters).
 * Use for detailed descriptions, notes, and long-form text content.
 * @example "Detailed product specifications and manufacturing process..."
 */
export const longStringSchema = z.string().min(1).max(2000);

/**
 * Validates email addresses.
 * @example "user@example.com"
 */
export const emailSchema = z.string().email();

/**
 * Validates URL format.
 * @example "https://example.com"
 */
export const urlSchema = z.string().url();

/**
 * Validates ISO 8601 datetime strings.
 * @example "2024-01-15T10:30:00Z"
 */
export const datetimeSchema = z.string().datetime();

/**
 * Validates ISO 3166-1 alpha-2 country codes (2-letter uppercase).
 * @example "US", "GB", "DE"
 */
export const countryCodeSchema = z.string().length(2).toUpperCase();

// ============================================================================
// Number Primitives
// ============================================================================

/**
 * Validates integer numbers.
 */
export const intSchema = z.number().int();

/**
 * Validates avatar hue values (1-359 degrees).
 * Used for generating avatar colors in the UI.
 */
export const avatarHueSchema = z.number().int().min(1).max(359);

/**
 * Validates percentage values (0-100).
 * Used for material composition, progress indicators, etc.
 */
export const percentageSchema = z.number().min(0).max(100);

/**
 * Validates non-negative integers (>= 0).
 * Used for counts, indices, sort orders, etc.
 */
export const nonNegativeIntSchema = z.number().int().min(0);

/**
 * Validates pagination limit (1-100).
 * Prevents excessive page sizes while allowing reasonable batches.
 */
export const paginationLimitSchema = intSchema.min(1).max(100);

// ============================================================================
// Array Primitives
// ============================================================================

/**
 * Validates arrays of UUIDs.
 * Used for bulk operations, associations, etc.
 */
export const uuidArraySchema = z.array(uuidSchema);
