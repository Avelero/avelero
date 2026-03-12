/**
 * Shared design tokens used by both the default and demo passports.
 *
 * Extracted here so the token definitions live in a single place and both
 * passport variants stay in sync.
 */

import type {
  ColorTokens,
  CustomFont,
  TypeScale,
  TypographyScale,
} from "../../types/passport";

const FONT_FAMILY = "Switzer Variable";
const FONT_URL =
  "https://storage.avelero.com/storage/v1/object/public/dpp-assets/system/fonts/Switzer-Variable.woff2";

export const DEFAULT_COLORS: ColorTokens = {
  background: "#FFFFFF",
  foreground: "#000000",
  muted: "#E5E5E5",
  mutedForeground: "#595959",
  card: "#FFFFFF",
  cardForeground: "#000000",
  primary: "#0000FF",
  primaryForeground: "#FFFFFF",
  border: "#F0F0F0",
  link: "#000000",
};

export const DEFAULT_TYPOGRAPHY: Record<TypeScale, TypographyScale> = {
  h1: {
    fontFamily: FONT_FAMILY,
    fontSize: 32,
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: 0,
    textTransform: "none",
  },
  h2: {
    fontFamily: FONT_FAMILY,
    fontSize: 28,
    fontWeight: 500,
    lineHeight: 1.3,
    letterSpacing: 0,
    textTransform: "none",
  },
  h3: {
    fontFamily: FONT_FAMILY,
    fontSize: 24,
    fontWeight: 500,
    lineHeight: 1.3,
    letterSpacing: 0,
    textTransform: "none",
  },
  h4: {
    fontFamily: FONT_FAMILY,
    fontSize: 21,
    fontWeight: 500,
    lineHeight: 1.3,
    letterSpacing: 0,
    textTransform: "none",
  },
  h5: {
    fontFamily: FONT_FAMILY,
    fontSize: 19,
    fontWeight: 500,
    lineHeight: 1.4,
    letterSpacing: 0,
    textTransform: "none",
  },
  h6: {
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    fontWeight: 500,
    lineHeight: 1.4,
    letterSpacing: 0,
    textTransform: "none",
  },
  body: {
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: 0,
    textTransform: "none",
  },
  "body-sm": {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: 0,
    textTransform: "none",
  },
  "body-xs": {
    fontFamily: FONT_FAMILY,
    fontSize: 11,
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: 0,
    textTransform: "none",
  },
};

export const DEFAULT_FONTS: CustomFont[] = [
  {
    fontFamily: FONT_FAMILY,
    src: FONT_URL,
    fontWeight: "100 900",
    fontStyle: "normal",
    format: "woff2",
    fontDisplay: "swap",
  },
];
