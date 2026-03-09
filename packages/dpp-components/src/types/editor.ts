/**
 * Editor type system — canonical definitions for the theme editor.
 *
 * Shared by both packages/dpp-components (section schemas, component schemas)
 * and apps/app (editor UI, style/content panels).
 */

import type { DppContent } from "./content";
import type { DppData } from "./data";
import type {
  Passport,
  Section,
  SectionType,
  Styles,
  ZoneId,
} from "./passport";

// ─── Style Fields ─────────────────────────────────────────────────────────────

export type StyleFieldType =
  | "color"
  | "number"
  | "radius"
  | "border"
  | "select"
  | "typescale"
  | "toggle";

export type StyleFieldValue =
  | string
  | number
  | boolean
  | Record<string, number>;

export interface StyleField {
  type: StyleFieldType;
  /**
   * Path into the section's styles, e.g. "card.borderColor".
   * The first segment is the style element key, the rest is the property path.
   */
  path: string;
  label: string;
  unit?: "px" | "%" | "em" | "rem";
  step?: number;
  options?: Array<{ value: string; label: string }>;
  /**
   * Optional section name to group fields under a header in the editor.
   * Fields without a section appear at the top ungrouped.
   */
  section?: string;
  /** Values written when a toggle is enabled or disabled. */
  enabledValue?: StyleFieldValue;
  disabledValue?: StyleFieldValue;
}

// ─── Content Fields ───────────────────────────────────────────────────────────

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
   * Path into the section's content, e.g. "headline" or "social.instagram".
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

// ─── Component Definition ─────────────────────────────────────────────────────

export type SectionVisibilityKey =
  | "showPrimaryMenu"
  | "showSecondaryMenu"
  | "showSimilarProducts"
  | "showCTABanner";

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

// ─── Section Schema ───────────────────────────────────────────────────────────

/** Default styles and content for a section type. */
export interface SectionDefaults {
  styles: Styles;
  content: Record<string, unknown>;
}

/** Schema describing a section type for the editor. */
export interface SectionSchema {
  type: SectionType;
  displayName: string;
  allowedZones: ZoneId[];
  editorTree: ComponentDefinition;
  defaults: SectionDefaults;
}

// ─── Fixed Component Schema ──────────────────────────────────────────────────

/** Schema describing a fixed component (header, footer, productImage, modal). */
export interface FixedComponentSchema {
  id: string;
  displayName: string;
  editorTree: ComponentDefinition;
  defaults: SectionDefaults;
}

// ─── Registry Types ───────────────────────────────────────────────────────────

export interface SectionRegistryEntry {
  schema: SectionSchema;
  component: React.ComponentType<SectionProps>;
}

export interface FixedComponentRegistryEntry {
  schema: FixedComponentSchema;
  component: React.ComponentType<unknown> | null;
}

// ─── Section Props ────────────────────────────────────────────────────────────

/** Props passed to every section component by the layout renderer. */
export interface SectionProps {
  section: Section;
  tokens: Passport["tokens"];
  data: DppData;
  zoneId: ZoneId;
  content?: DppContent;
  wrapperClassName?: string;
  /** Resolved passport-level modal styles, passed by the layout renderer. */
  modalStyles?: Record<string, React.CSSProperties>;
  /** Modal content settings shared across sections, passed by the layout renderer. */
  modalContent?: Passport["modal"]["content"];
}
