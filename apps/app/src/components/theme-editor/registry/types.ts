/**
 * Type definitions for the component registry
 */

// =============================================================================
// STYLE FIELD TYPE DEFINITIONS
// =============================================================================

export type StyleFieldType =
  | "color"
  | "number"
  | "radius" // 4-corner border-radius input
  | "border" // 4-side border-width input
  | "select"
  | "typescale" // Dropdown to select from H1-H6, Body, Body-sm, Body-xs
  | "toggle";

export interface StyleField {
  type: StyleFieldType;
  /**
   * Path into the section's styles, e.g. "card.borderColor"
   * The first segment is the style element key, the rest is the property path.
   */
  path: string;
  label: string;
  unit?: "px" | "%" | "em" | "rem";
  options?: Array<{ value: string; label: string }>;
  /**
   * Optional section name to group fields under a header in the editor.
   * Fields without a section appear at the top ungrouped.
   */
  section?: string;
}

// =============================================================================
// CONTENT FIELD TYPE DEFINITIONS
// =============================================================================

export type ContentFieldType =
  | "text"
  | "textarea"
  | "url"
  | "image"
  | "toggle"
  | "number"
  | "modal";

export interface ContentField {
  type: ContentFieldType;
  /**
   * Path into the section's content, e.g. "headline" or "social.instagram"
   */
  path: string;
  label: string;
  placeholder?: string;
  /**
   * Optional section name to group fields under a header in the editor.
   */
  section?: string;
  modalType?: "menu-primary" | "menu-secondary" | "carousel-products";
  min?: number;
  max?: number;
}

// =============================================================================
// SECTION VISIBILITY KEYS (for eye icon toggles)
// =============================================================================

export type SectionVisibilityKey =
  | "showPrimaryMenu"
  | "showSecondaryMenu"
  | "showSimilarProducts"
  | "showCTABanner";

// =============================================================================
// COMPONENT DEFINITION
// =============================================================================

export interface ComponentDefinition {
  id: string;
  displayName: string;
  children?: ComponentDefinition[];
  visibilityKey?: SectionVisibilityKey;
  styleFields?: StyleField[];
  configFields?: ContentField[];
  isGrouping?: boolean;
  hidden?: boolean;
}
