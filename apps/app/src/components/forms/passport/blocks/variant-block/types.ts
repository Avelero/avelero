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
   * For taxonomy-linked attributes: array of taxonomy value IDs
   * For existing custom attributes: array of brand value IDs
   */
  values: string[];
  /**
   * Values that don't exist yet - raw strings typed by user.
   * Will be created when passport is saved.
   */
  pendingValues?: string[];
  
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
