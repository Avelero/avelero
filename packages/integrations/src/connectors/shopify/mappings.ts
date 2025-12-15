/**
 * Shopify Field Mappings & Transforms
 *
 * Transform functions that convert Shopify data to Avelero format.
 *
 * Option Type Detection Strategy:
 * 1. Primary: Use linkedMetafield.key ("color-pattern", "size") - language-agnostic, 100% reliable
 * 2. Fallback: Name-based matching for stores not using Shopify's category metafields
 *
 * Data Extraction:
 * - Color hex: Extracted from optionValues[].swatch.color (direct from Shopify)
 * - Size order: Extracted from optionValues array index (preserves merchant's order)
 */

import type {
  ShopifySelectedOption,
  ShopifyProductOption,
} from "./types.ts";

// =============================================================================
// OPTION TYPE DETECTION
// =============================================================================

/**
 * Keywords for name-based color detection (fallback for stores without linkedMetafield).
 * Includes common translations and variations.
 */
const COLOR_KEYWORDS = [
  "color",
  "colour",
  "kleur", // Dutch
  "farbe", // German
  "couleur", // French
  "colore", // Italian
  "cor", // Portuguese
  "color", // Spanish
  "färg", // Swedish
  "farge", // Norwegian
  "väri", // Finnish
];

/**
 * Keywords for name-based size detection (fallback for stores without linkedMetafield).
 * Includes common translations and variations.
 */
const SIZE_KEYWORDS = [
  "size",
  "taille", // French
  "maat", // Dutch
  "größe", // German
  "grootte", // Dutch alternative
  "taglia", // Italian
  "tamanho", // Portuguese
  "tamaño", // Spanish
  "storlek", // Swedish
  "størrelse", // Norwegian/Danish
  "koko", // Finnish
];

/**
 * Check if an option is a color option using linkedMetafield.key (primary)
 * or name matching (fallback).
 */
function isColorOption(option: ShopifyProductOption): boolean {
  // Primary: Use linkedMetafield.key (language-agnostic, definitive)
  if (option.linkedMetafield?.key === "color-pattern") {
    return true;
  }

  // Fallback: Name-based detection for stores not using category metafields
  const nameLower = option.name.toLowerCase();
  return COLOR_KEYWORDS.some((keyword) => nameLower.includes(keyword));
}

/**
 * Check if an option is a size option using linkedMetafield.key (primary)
 * or name matching (fallback).
 */
function isSizeOption(option: ShopifyProductOption): boolean {
  // Primary: Use linkedMetafield.key (language-agnostic, definitive)
  if (option.linkedMetafield?.key === "size") {
    return true;
  }

  // Fallback: Name-based detection for stores not using category metafields
  const nameLower = option.name.toLowerCase();
  return SIZE_KEYWORDS.some((keyword) => nameLower.includes(keyword));
}

/**
 * Find the color option from product options.
 */
export function findColorOption(
  options: ShopifyProductOption[] | null | undefined
): ShopifyProductOption | null {
  if (!options || !Array.isArray(options)) return null;
  return options.find(isColorOption) ?? null;
}

/**
 * Find the size option from product options.
 */
export function findSizeOption(
  options: ShopifyProductOption[] | null | undefined
): ShopifyProductOption | null {
  if (!options || !Array.isArray(options)) return null;
  return options.find(isSizeOption) ?? null;
}

// =============================================================================
// COLOR EXTRACTION
// =============================================================================

/**
 * Extracted color data including hex value from Shopify swatch.
 */
export interface ExtractedColorData {
  name: string;
  /** Hex color value from Shopify's swatch.color (e.g., "#FF8A00") */
  hex: string | null;
}

/**
 * Extract color data from variant's selectedOptions, enriched with hex from product options.
 *
 * Strategy:
 * 1. Find the color option in product.options using linkedMetafield.key or name matching
 * 2. Get the variant's color value from selectedOptions
 * 3. Look up the hex value from the corresponding optionValue's swatch
 */
export function extractColorFromOptions(
  selectedOptions: ShopifySelectedOption[] | undefined,
  productOptions?: ShopifyProductOption[] | null
): ExtractedColorData | null {
  if (!selectedOptions || !Array.isArray(selectedOptions)) return null;

  // Find which option is the color option
  const colorOption = findColorOption(productOptions);

  // Get the variant's selected color value
  let colorValue: string | null = null;

  if (colorOption) {
    // We know the exact option name, find the matching selectedOption
    const selectedColor = selectedOptions.find(
      (opt) => opt.name === colorOption.name
    );
    colorValue = selectedColor?.value ?? null;
  } else {
    // Fallback: Search selectedOptions by name keywords
    const selectedColor = selectedOptions.find((opt) => {
      const name = opt.name?.toLowerCase();
      return COLOR_KEYWORDS.some((keyword) => name?.includes(keyword));
    });
    colorValue = selectedColor?.value ?? null;
  }

  if (!colorValue) return null;

  // Look up hex value from optionValues swatch
  let hex: string | null = null;
  if (colorOption?.optionValues) {
    const optionValue = colorOption.optionValues.find(
      (v) => v.name === colorValue
    );
    hex = optionValue?.swatch?.color ?? null;
  }

  return { name: colorValue, hex };
}

// =============================================================================
// SIZE EXTRACTION
// =============================================================================

/**
 * Extracted size data including Shopify index for sort order.
 */
export interface ExtractedSizeData {
  name: string;
  /** Index in Shopify's optionValues array (preserves merchant's order) */
  shopifyIndex: number | null;
}

/**
 * Extract size data from variant's selectedOptions, enriched with index from product options.
 *
 * Strategy:
 * 1. Find the size option in product.options using linkedMetafield.key or name matching
 * 2. Get the variant's size value from selectedOptions
 * 3. Find the index in optionValues array (merchant's chosen order)
 */
export function extractSizeFromOptions(
  selectedOptions: ShopifySelectedOption[] | undefined,
  productOptions?: ShopifyProductOption[] | null
): ExtractedSizeData | null {
  if (!selectedOptions || !Array.isArray(selectedOptions)) return null;

  // Find which option is the size option
  const sizeOption = findSizeOption(productOptions);

  // Get the variant's selected size value
  let sizeValue: string | null = null;

  if (sizeOption) {
    // We know the exact option name, find the matching selectedOption
    const selectedSize = selectedOptions.find(
      (opt) => opt.name === sizeOption.name
    );
    sizeValue = selectedSize?.value ?? null;
  } else {
    // Fallback: Search selectedOptions by name keywords
    const selectedSize = selectedOptions.find((opt) => {
      const name = opt.name?.toLowerCase();
      return SIZE_KEYWORDS.some((keyword) => name?.includes(keyword));
    });
    sizeValue = selectedSize?.value ?? null;
  }

  if (!sizeValue) return null;

  // Find index in optionValues array (merchant's order)
  let shopifyIndex: number | null = null;
  if (sizeOption?.optionValues) {
    const index = sizeOption.optionValues.findIndex((v) => v.name === sizeValue);
    shopifyIndex = index >= 0 ? index : null;
  }

  return { name: sizeValue, shopifyIndex };
}

/**
 * Transform Shopify product status to Avelero publication status.
 * Shopify: ACTIVE, DRAFT, ARCHIVED
 * Avelero: published, unpublished, archived
 */
export function transformStatus(status: unknown): string {
  const s = String(status).toUpperCase();
  if (s === "ACTIVE") return "published";
  if (s === "DRAFT") return "unpublished";
  if (s === "ARCHIVED") return "archived";
  return "unpublished";
}

/**
 * Transform Shopify product status to Avelero sales status.
 * Shopify: ACTIVE, DRAFT, ARCHIVED
 * Avelero: active, inactive, discontinued
 */
export function transformSalesStatus(status: unknown): string {
  const s = String(status).toUpperCase();
  if (s === "ACTIVE") return "active";
  if (s === "DRAFT") return "inactive";
  if (s === "ARCHIVED") return "discontinued";
  return "inactive";
}

/**
 * Extract numeric ID from Shopify GID.
 * Example: "gid://shopify/Product/123456" → "123456"
 */
export function extractShopifyId(gid: unknown): string | null {
  if (!gid || typeof gid !== "string") return null;
  const match = gid.match(/\/(\d+)$/);
  return match?.[1] ?? null;
}

/**
 * Safely parse a price value to number.
 */
export function parseShopifyPrice(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Truncate string to max length.
 */
export function truncateString(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length > maxLength ? str.slice(0, maxLength) : str;
}

/**
 * Clean HTML tags from description (basic).
 */
export function stripHtmlTags(html: unknown): string | null {
  if (!html || typeof html !== "string") return null;
  return html.replace(/<[^>]*>/g, "").trim();
}

/**
 * Transform Shopify tags to normalized strings.
 * 
 * Handles two possible formats from Shopify:
 * - GraphQL Admin API: Array of strings ["summer", "sports"]
 * - String format: Comma-separated "summer, sports"
 * 
 * The GraphQL API should return an array, but we handle both for robustness.
 */
export function transformTags(tags: unknown): string[] {
  if (!tags) return [];
  
  // Handle array format (expected from GraphQL API)
  if (Array.isArray(tags)) {
    return tags
      .map((t) => String(t).trim())
      .filter((t) => t.length > 0);
  }
  
  // Handle comma-separated string format (defensive handling)
  if (typeof tags === "string") {
    return tags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }
  
  return [];
}

