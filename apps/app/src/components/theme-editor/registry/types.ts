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
   * Path into ThemeStyles object, e.g. "journey-card.borderColor"
   * The first segment is the component key, the rest is the property path
   */
  path: string;
  label: string;
  unit?: "px" | "%" | "em" | "rem";
  options?: Array<{ value: string; label: string }>;
  /**
   * Optional section name to group fields under a header in the editor.
   * Fields without a section appear at the top ungrouped.
   * Example sections: "Text", "Icon", "Background", "Border"
   */
  section?: string;
}

// =============================================================================
// CONTENT FIELD TYPE DEFINITIONS (for ThemeConfig editing)
// =============================================================================

export type ContentFieldType =
  | "text" // Simple text input
  | "textarea" // Multi-line text
  | "url" // URL input
  | "image" // Image uploader
  | "toggle" // Boolean toggle
  | "number" // Numeric input
  | "modal"; // Opens modal (deferred to Phase 7)

export interface ContentField {
  type: ContentFieldType;
  /**
   * Path into ThemeConfig object, e.g. "cta.bannerHeadline"
   */
  path: string;
  label: string;
  placeholder?: string;
  /**
   * Optional section name to group fields under a header in the editor.
   * Fields without a section appear at the top ungrouped.
   * Example sections: "Visibility", "Headline", "Social Links"
   */
  section?: string;
  /**
   * For modal fields - which modal to open (deferred to Phase 7)
   */
  modalType?: "menu-primary" | "menu-secondary" | "carousel-products";
  /**
   * For number fields - minimum value
   */
  min?: number;
  /**
   * For number fields - maximum value
   */
  max?: number;
}

// =============================================================================
// SECTION VISIBILITY KEYS (for eye icon toggles)
// =============================================================================

/**
 * Valid keys for section visibility toggles.
 * These map to ThemeConfig.sections properties.
 * Note: Only menus, carousel, and banner can be hidden via eye icons.
 * Other sections (product details, impact, materials, journey) are always visible.
 */
export type SectionVisibilityKey =
  | "showPrimaryMenu"
  | "showSecondaryMenu"
  | "showSimilarProducts"
  | "showCTABanner";

// =============================================================================
// COMPONENT DEFINITION
// =============================================================================

export interface ComponentDefinition {
  /**
   * Unique identifier - matches the CSS class name in globals.css
   * e.g. "product-details", "journey-card__title"
   */
  id: string;

  /**
   * Human-readable name shown in the UI
   */
  displayName: string;

  /**
   * Nested child components
   */
  children?: ComponentDefinition[];

  /**
   * Key for section visibility toggle (shows eye icon in layout tree).
   * Maps to ThemeConfig.sections[key].
   * Only for top-level sections that have corresponding sections.show* flags.
   */
  visibilityKey?: SectionVisibilityKey;

  /**
   * Design token fields from ThemeStyles
   */
  styleFields?: StyleField[];

  /**
   * Content fields from ThemeConfig (for the Content tab)
   */
  configFields?: ContentField[];

  /**
   * If true, this component only serves to group children in the tree.
   * It will expand/collapse on click instead of navigating to an editor.
   * - No chevronRight icon shown
   * - No cursor-pointer on hover
   * - Click just toggles expand/collapse
   */
  isGrouping?: boolean;

  /**
   * If true, this component is hidden from the theme editor UI.
   * Used to temporarily disable features while keeping the code in place.
   */
  hidden?: boolean;
}
