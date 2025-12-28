/**
 * Types for the variant block components.
 */

export interface VariantDimension {
  id: string; // local id for dnd

  // For existing catalog attributes:
  attributeId: string | null; // null if selecting attribute for first time or custom inline
  attributeName: string;
  taxonomyAttributeId: string | null;
  /**
   * Array of brand attribute value IDs (for both taxonomy-linked and custom attributes).
   * The UI uses these IDs to look up display names and hex colors.
   */
  values: string[];

  // For custom inline (not yet saved to catalog):
  isCustomInline?: boolean;
  customAttributeName?: string;
  customValues?: string[]; // raw string values, created on passport save
}

export interface VariantMetadata {
  sku?: string;
  barcode?: string;
}

export interface ExplicitVariant {
  sku: string;
  barcode: string;
}
