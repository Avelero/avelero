/**
 * Input validation utilities for DPP route parameters.
 *
 * These functions validate URL parameters before querying the database,
 * preventing unnecessary queries for malformed inputs.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Regex Patterns
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates brand slugs.
 * - Lowercase letters, numbers, and dashes
 * - No leading/trailing dashes
 * - 2-50 characters
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Validates UPIDs (Unique Product Identifiers).
 * - 16 alphanumeric characters
 * - Case insensitive (stored lowercase)
 */
const UPID_PATTERN = /^[a-zA-Z0-9]{16}$/;

// ─────────────────────────────────────────────────────────────────────────────
// Validation Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates a brand slug format.
 *
 * @param slug - The slug to validate
 * @returns true if valid brand slug format
 */
export function isValidSlug(slug: string): boolean {
  if (slug.length < 2 || slug.length > 50) return false;
  return SLUG_PATTERN.test(slug);
}

/**
 * Validates a UPID format.
 *
 * @param upid - The UPID to validate
 * @returns true if valid UPID format (16 alphanumeric chars)
 */
export function isValidUpid(upid: string): boolean {
  return UPID_PATTERN.test(upid);
}

/**
 * Validates all route parameters for a product-level DPP page.
 *
 * @param brandSlug - Brand slug from URL
 * @param productUpid - Product UPID from URL
 * @returns true if all parameters are valid
 */
export function validateProductParams(
  brandSlug: string,
  productUpid: string,
): boolean {
  return isValidSlug(brandSlug) && isValidUpid(productUpid);
}

/**
 * Validates all route parameters for a variant-level DPP page.
 *
 * @param brandSlug - Brand slug from URL
 * @param productUpid - Product UPID from URL
 * @param variantUpid - Variant UPID from URL
 * @returns true if all parameters are valid
 */
export function validateVariantParams(
  brandSlug: string,
  productUpid: string,
  variantUpid: string,
): boolean {
  return (
    isValidSlug(brandSlug) &&
    isValidUpid(productUpid) &&
    isValidUpid(variantUpid)
  );
}

