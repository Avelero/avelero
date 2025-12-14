/**
 * Input validation utilities for DPP route parameters.
 *
 * These functions validate URL parameters before querying the database,
 * preventing unnecessary queries for malformed inputs.
 * 
 * URL structure: /[brandSlug]/[productHandle]/[variantUpid]/
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
 * Validates a UPID format (for variant identifiers).
 *
 * @param upid - The UPID to validate
 * @returns true if valid UPID format (16 alphanumeric chars)
 */
export function isValidUpid(upid: string): boolean {
  return UPID_PATTERN.test(upid);
}

/**
 * Validates a product handle format.
 * Product handles are brand-defined identifiers used in URLs.
 * - Non-empty string
 * - Max 255 characters
 *
 * @param handle - The product handle to validate
 * @returns true if valid product handle format
 */
export function isValidProductHandle(handle: string): boolean {
  return handle.length >= 1 && handle.length <= 255;
}

/**
 * Validates all route parameters for a product-level DPP page.
 * URL: /[brandSlug]/[productHandle]/
 *
 * @param brandSlug - Brand slug from URL
 * @param productHandle - Product handle from URL (brand-defined identifier)
 * @returns true if all parameters are valid
 */
export function validateProductParams(
  brandSlug: string,
  productHandle: string,
): boolean {
  return isValidSlug(brandSlug) && isValidProductHandle(productHandle);
}

/**
 * Validates all route parameters for a variant-level DPP page.
 * URL: /[brandSlug]/[productHandle]/[variantUpid]/
 *
 * @param brandSlug - Brand slug from URL
 * @param productHandle - Product handle from URL (brand-defined identifier)
 * @param variantUpid - Variant UPID from URL (16-char alphanumeric)
 * @returns true if all parameters are valid
 */
export function validateVariantParams(
  brandSlug: string,
  productHandle: string,
  variantUpid: string,
): boolean {
  return (
    isValidSlug(brandSlug) &&
    isValidProductHandle(productHandle) &&
    isValidUpid(variantUpid)
  );
}

