/**
 * Type definitions for the component library registry.
 *
 * These mirror the editor registry types from the app but live in dpp-components
 * so the component library can be shared across packages.
 */

export type StyleFieldType =
  | "color"
  | "number"
  | "radius"
  | "border"
  | "select"
  | "typescale"
  | "toggle";

export interface StyleField {
  type: StyleFieldType;
  path: string;
  label: string;
  unit?: "px" | "%" | "em" | "rem";
  options?: Array<{ value: string; label: string }>;
  section?: string;
}

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
  path: string;
  label: string;
  placeholder?: string;
  section?: string;
  modalType?: "menu-primary" | "menu-secondary" | "carousel-products";
  min?: number;
  max?: number;
}

export interface ComponentDefinition {
  id: string;
  displayName: string;
  children?: ComponentDefinition[];
  styleFields?: StyleField[];
  configFields?: ContentField[];
  isGrouping?: boolean;
}
