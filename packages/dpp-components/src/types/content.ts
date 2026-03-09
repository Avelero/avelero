/**
 * DPP Content Types - Non-Compliance Marketing/Content Data
 *
 * These types represent content that is displayed on the DPP page but is NOT
 * part of the official EU compliance data that gets submitted to registries.
 *
 * Examples include:
 * - Similar products carousel (marketing/upsell)
 * - Additional marketing content
 *
 * This separation allows:
 * - Clean compliance data that can be submitted to EU registry unchanged
 * - Flexibility to add/remove marketing features without affecting compliance
 * - Clear distinction between mandatory and optional DPP content
 */

// =============================================================================
// SIMILAR PRODUCTS (CAROUSEL)
// =============================================================================

/**
 * Product data for the similar products carousel
 *
 * This is marketing/upsell content, not compliance data.
 * May be removed in future versions if carousel feature is deprecated.
 */
export interface SimilarProduct {
  /** Product image URL */
  image: string;
  /** Product display name */
  name: string;
  /** Product price (in brand's default currency) */
  price: number;
  /** Currency code (e.g., "EUR", "USD") - defaults to brand currency if not specified */
  currency?: string;
  /** Link to the product page or DPP */
  url?: string;
}

// =============================================================================
// DPP CONTENT WRAPPER
// =============================================================================

/**
 * Non-compliance content that accompanies DPP data
 *
 * This content is displayed alongside compliance data but is not part of
 * the official DPP schema that gets submitted to EU registries.
 */
export interface DppContent {
  /** Similar products for the carousel section */
  similarProducts?: SimilarProduct[];
}
