/**
 * Layout Configuration Types
 *
 * Defines the zone-based layout system where brands can arrange
 * component instances within zones (like Shopify's theme editor).
 */

/** The three layout zones that contain component instances */
export type ZoneId = "column-left" | "column-right" | "content";

/** Available component types that can be placed in zones */
export type ComponentType =
  | "image" // ProductImage
  | "hero" // ProductDescription (brand, title, description)
  | "details" // ProductDetails
  | "buttons" // MenuFrame (primary or secondary variant)
  | "impact" // ImpactFrame
  | "materials" // MaterialsFrame
  | "journey" // JourneyFrame
  | "banner"; // CTABanner

/** A single placed instance of a component within a zone */
export interface LayoutComponentInstance {
  /** Unique instance ID (e.g. "inst_a1b2c3") */
  id: string;
  /** Which component type from the library */
  componentType: ComponentType;
  /** Instance-specific content (e.g. menu items for buttons, banner text) */
  content?: Record<string, unknown>;
  /** Instance-specific style overrides (CSS variable name -> value) */
  styles?: Record<string, unknown>;
}

/** The full layout configuration stored in ThemeConfig */
export interface LayoutConfig {
  version: 1;
  zones: {
    "column-left": LayoutComponentInstance[];
    "column-right": LayoutComponentInstance[];
    content: LayoutComponentInstance[];
  };
}
