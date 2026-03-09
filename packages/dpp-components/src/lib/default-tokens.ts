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
} from "../types/passport";

const FONT_FAMILY = "Switzer Variable";
const FONT_URL =
  "https://storage.avelero.com/storage/v1/object/public/dpp-assets/system/fonts/Switzer-Variable.woff2";

export const DEFAULT_COLORS: ColorTokens = {
  background: "#FFFFFF",
  foreground: "#000000",
  mutedLight: "#E0E0E0",
  mutedLightForeground: "#808080",
  mutedDark: "#EBEBEB",
  mutedDarkForeground: "#4D4D4D",
  card: "#FFFFFF",
  cardForeground: "#000000",
  primary: "#0000FF",
  primaryForeground: "#FFFFFF",
  border: "#F2F2F2",
  link: "#0000FF",
};

export const DEFAULT_TYPOGRAPHY: Record<TypeScale, TypographyScale> = {
  h1: {
    fontFamily: FONT_FAMILY,
    fontSize: 32,
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: 0,
  },
  h2: {
    fontFamily: FONT_FAMILY,
    fontSize: 28,
    fontWeight: 500,
    lineHeight: 1.3,
    letterSpacing: 0,
  },
  h3: {
    fontFamily: FONT_FAMILY,
    fontSize: 24,
    fontWeight: 500,
    lineHeight: 1.3,
    letterSpacing: 0,
  },
  h4: {
    fontFamily: FONT_FAMILY,
    fontSize: 21,
    fontWeight: 500,
    lineHeight: 1.3,
    letterSpacing: 0,
  },
  h5: {
    fontFamily: FONT_FAMILY,
    fontSize: 19,
    fontWeight: 500,
    lineHeight: 1.4,
    letterSpacing: 0,
  },
  h6: {
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    fontWeight: 500,
    lineHeight: 1.4,
    letterSpacing: 0,
  },
  body: {
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: 0,
  },
  "body-sm": {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: 0,
  },
  "body-xs": {
    fontFamily: FONT_FAMILY,
    fontSize: 11,
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: 0,
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
