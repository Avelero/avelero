/**
 * Passport — the single JSON document that defines a brand's Digital Product Passport.
 *
 * Stored per-brand in the database. Contains all layout, content, and styling configuration.
 * At render time, section components resolve styles inline from this document — no CSS
 * variables are used for component styling (only for global design tokens on .dpp-root).
 */

// =============================================================================
// Design Tokens
// =============================================================================

export interface ColorTokens {
  background: string;
  foreground: string;
  mutedLight: string;
  mutedLightForeground: string;
  mutedDark: string;
  mutedDarkForeground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  border: string;
  link: string;
}

export type ColorTokenKey = keyof ColorTokens;

export interface TypographyScale {
  fontFamily: string;
  fontSize: number; // px — converted to rem at render
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number; // px
}

export type TypeScale =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "body"
  | "body-sm"
  | "body-xs";

export interface CustomFont {
  fontFamily: string;
  src: string;
  fontWeight?: number | string;
  fontStyle?: string;
  fontDisplay?: string;
  format?: string;
  unicodeRange?: string;
}

// =============================================================================
// Style Overrides
// =============================================================================

/**
 * Style override for a single element within a section.
 *
 * Color values can be hex ("#FF0000") or token references ("$foreground").
 * Token references are resolved at render time against the passport's color tokens.
 */
export interface StyleOverride {
  color?: string;
  backgroundColor?: string;
  boxShadow?: string;
  borderColor?: string;
  aspectRatio?: number;
  height?: number;
  typescale?: TypeScale;
  typographyDetached?: boolean;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  textAlign?: "left" | "center" | "right";
  borderRadius?:
    | number
    | {
        topLeft: number;
        topRight: number;
        bottomLeft: number;
        bottomRight: number;
      };
  borderWidth?:
    | number
    | { top: number; right: number; bottom: number; left: number };
  alignItems?: string;
  justifyContent?: string;
  size?: number; // icon width/height in px
}

/** Map of element names to their style overrides. Keys are local to the section type. */
export type Styles = Record<string, StyleOverride>;

// =============================================================================
// Sections
// =============================================================================

export type SectionType =
  | "impact"
  | "details"
  | "hero"
  | "description"
  | "materials"
  | "journey"
  | "buttons"
  | "banner"
  | "carousel"
  | "imageCards"
  | "textImage"
  | "separator";

export type ZoneId = "sidebar" | "canvas";

export interface Section {
  id: string; // "sec_" + 8 chars
  type: SectionType;
  content: Record<string, unknown>;
  styles: Styles;
}

// =============================================================================
// Social Links
// =============================================================================

/** Social media links. Truthy URL = visible, undefined/empty = hidden. */
export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  pinterest?: string;
  tiktok?: string;
  youtube?: string;
  linkedin?: string;
}

// =============================================================================
// Passport
// =============================================================================

export interface Passport {
  version: 2;
  tokens: {
    colors: ColorTokens;
    typography: Record<TypeScale, TypographyScale>;
    fonts?: CustomFont[];
  };
  header: {
    logoUrl: string;
    styles: Styles;
  };
  productImage: {
    styles: Styles;
  };
  modal: {
    content: {
      showExactLocation: boolean;
    };
    styles: Styles;
  };
  footer: {
    social: SocialLinks;
    styles: Styles;
  };
  sidebar: Section[];
  canvas: Section[];
}
