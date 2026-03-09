/**
 * Canonical default passport template.
 *
 * This file is the single runtime source of truth for the default Digital
 * Product Passport used by the editor demo and newly created brands.
 */

import type { Passport, Section, SectionType } from "../types/passport";

type SectionTemplate = Omit<Section, "id">;

const DEFAULT_PASSPORT_FONT_FAMILY = "Switzer Variable";
const DEFAULT_PASSPORT_FONT_URL =
  "https://storage.avelero.com/storage/v1/object/public/dpp-assets/system/fonts/Switzer-Variable.woff2";

const SURFACE_CARD_SHADOW =
  "0px 0px 2px rgba(0, 0, 0, 0.15), 0px 2px 5px rgba(0, 0, 0, 0.05), 0px 8px 40px rgba(0, 0, 0, 0.04)";

const DEFAULT_MODAL_STYLES: SectionTemplate["styles"] = {
  "modal.container": {
    backgroundColor: "$card",
    boxShadow: SURFACE_CARD_SHADOW,
    borderColor: "$border",
    borderRadius: 8,
    borderWidth: 0,
  },
  "modal.title": {
    typescale: "h2",
    color: "$foreground",
    textTransform: "none",
  },
  "modal.subtitle": {
    typescale: "h6",
    color: "$mutedLightForeground",
    textTransform: "none",
  },
  "modal.description": {
    typescale: "body",
    color: "$mutedDarkForeground",
    textTransform: "none",
  },
  "modal.label": {
    typescale: "body",
    typographyDetached: true,
    fontWeight: 500,
    color: "$mutedLightForeground",
    textTransform: "none",
  },
  "modal.value": {
    typescale: "body",
    color: "$foreground",
    textTransform: "none",
  },
};

const DEFAULT_HERO_SECTION_TEMPLATE: SectionTemplate = {
  type: "hero",
  content: {},
  styles: {
    title: { typescale: "h1", color: "$foreground", textTransform: "none" },
    brand: {
      typescale: "h5",
      color: "$mutedLightForeground",
      textTransform: "none",
    },
  },
};

const DEFAULT_DESCRIPTION_SECTION_TEMPLATE: SectionTemplate = {
  type: "description",
  content: {},
  styles: {
    header: { borderColor: "$border" },
    heading: { typescale: "h6", color: "$foreground", textTransform: "none" },
    body: {
      typescale: "body",
      color: "$mutedDarkForeground",
      textTransform: "none",
    },
    showMore: {
      typescale: "body",
      typographyDetached: true,
      fontWeight: 600,
      color: "$link",
      textTransform: "none",
    },
    ...DEFAULT_MODAL_STYLES,
  },
};

const DEFAULT_DETAILS_SECTION_TEMPLATE: SectionTemplate = {
  type: "details",
  content: {},
  styles: {
    header: { borderColor: "$border" },
    heading: { typescale: "h6", color: "$foreground", textTransform: "none" },
    row: { borderColor: "$border" },
    label: {
      typescale: "body",
      typographyDetached: true,
      lineHeight: 1.2,
      color: "$mutedLightForeground",
      textTransform: "none",
    },
    value: {
      typescale: "body",
      typographyDetached: true,
      lineHeight: 1.2,
      color: "$foreground",
      textTransform: "none",
    },
    ...DEFAULT_MODAL_STYLES,
  },
};

const DEFAULT_BUTTONS_SECTION_TEMPLATE: SectionTemplate = {
  type: "buttons",
  content: {
    variant: "primary",
    menuItems: [
      { label: "Care instructions", url: "https://avelero.com/" },
      { label: "Recycling & Repair", url: "https://avelero.com/" },
      { label: "Warranty", url: "https://avelero.com/" },
    ],
  },
  styles: {
    button: {
      typescale: "h6",
      color: "$cardForeground",
      backgroundColor: "$card",
      boxShadow: SURFACE_CARD_SHADOW,
      borderRadius: 8,
      borderWidth: 0,
      textTransform: "none",
    },
    "button.icon": { color: "$cardForeground", size: 20 },
  },
};

const DEFAULT_IMPACT_SECTION_TEMPLATE: SectionTemplate = {
  type: "impact",
  content: {},
  styles: {
    title: {
      typescale: "h6",
      color: "$foreground",
      textTransform: "none",
    },
    helpLink: {
      typescale: "body",
      typographyDetached: true,
      fontWeight: 500,
      color: "$mutedLightForeground",
      textTransform: "none",
    },
    card: {
      backgroundColor: "$card",
      boxShadow: SURFACE_CARD_SHADOW,
      borderRadius: 8,
      borderWidth: 0,
    },
    "card.icon": { color: "$primary", size: 28 },
    "card.type": {
      typescale: "body-sm",
      color: "$mutedLightForeground",
      textTransform: "none",
    },
    "card.value": {
      typescale: "h1",
      typographyDetached: true,
      fontWeight: 500,
      lineHeight: 1,
      color: "$cardForeground",
      textTransform: "none",
    },
    "card.unit": {
      typescale: "body-sm",
      color: "$mutedLightForeground",
      textTransform: "none",
    },
    ...DEFAULT_MODAL_STYLES,
  },
};

const DEFAULT_MATERIALS_SECTION_TEMPLATE: SectionTemplate = {
  type: "materials",
  content: {
    showCertificationCheckIcon: false,
  },
  styles: {
    title: { typescale: "h6", color: "$foreground", textTransform: "none" },
    card: {
      backgroundColor: "$card",
      boxShadow: SURFACE_CARD_SHADOW,
      borderColor: "$border",
      borderRadius: 8,
      borderWidth: 0,
    },
    "card.percentage": {
      typescale: "h6",
      color: "$cardForeground",
      textTransform: "none",
    },
    "card.type": {
      typescale: "h6",
      color: "$cardForeground",
      textTransform: "none",
    },
    "card.origin": {
      typescale: "body",
      color: "$mutedLightForeground",
      textTransform: "none",
    },
    "card.locationIcon": { color: "$mutedLightForeground", size: 14 },
    "card.certification": {
      typescale: "body-sm",
      typographyDetached: true,
      lineHeight: 2,
      color: "$cardForeground",
      backgroundColor: "$mutedDark",
      borderRadius: 9999,
      textTransform: "none",
    },
    "card.certIcon": { color: "$cardForeground", size: 14 },
    "card.certText": {
      typescale: "body",
      typographyDetached: true,
      fontWeight: 500,
      color: "$cardForeground",
      textTransform: "none",
    },
    ...DEFAULT_MODAL_STYLES,
  },
};

const DEFAULT_JOURNEY_SECTION_TEMPLATE: SectionTemplate = {
  type: "journey",
  content: {},
  styles: {
    title: {
      typescale: "h6",
      color: "$foreground",
      textTransform: "none",
    },
    card: {
      backgroundColor: "$card",
      boxShadow: SURFACE_CARD_SHADOW,
      borderColor: "$border",
      borderRadius: 8,
      borderWidth: 0,
    },
    "card.type": {
      typescale: "h6",
      color: "$cardForeground",
      textTransform: "none",
    },
    "card.operator": {
      typescale: "body",
      typographyDetached: true,
      fontWeight: 500,
      color: "$cardForeground",
      textTransform: "none",
    },
    "card.location": {
      typescale: "body",
      color: "$mutedLightForeground",
      textTransform: "none",
    },
    "card.locationIcon": { color: "$mutedLightForeground", size: 14 },
    "card.line": { backgroundColor: "$mutedLight" },
    "card.dot": { backgroundColor: "$mutedLight" },
    ...DEFAULT_MODAL_STYLES,
  },
};

const DEFAULT_BANNER_SECTION_TEMPLATE: SectionTemplate = {
  type: "banner",
  content: {
    headline: "",
    subline: "",
    ctaText: "",
    ctaUrl: "",
    backgroundImage: "",
  },
  styles: {
    container: { backgroundColor: "$primary", borderRadius: 0 },
    headline: {
      typescale: "h2",
      color: "$primaryForeground",
      textAlign: "center",
      textTransform: "none",
    },
    subline: {
      typescale: "body",
      color: "$primaryForeground",
      textAlign: "center",
      textTransform: "none",
    },
    button: {
      typescale: "body-sm",
      color: "$primaryForeground",
      borderColor: "$primaryForeground",
      borderRadius: 0,
      borderWidth: 1,
      textTransform: "none",
    },
  },
};

const DEFAULT_CAROUSEL_SECTION_TEMPLATE: SectionTemplate = {
  type: "carousel",
  content: {
    showTitle: true,
    showPrice: true,
    roundPrice: true,
    productCount: 6,
  },
  styles: {
    title: { typescale: "h6", color: "$foreground", textTransform: "none" },
    navButton: {
      color: "$foreground",
      backgroundColor: "$background",
      borderColor: "$border",
    },
    productImage: { borderColor: "$border", borderRadius: 0 },
    productDetails: {},
    productName: {
      typescale: "body-sm",
      color: "$foreground",
      textTransform: "none",
    },
    productPrice: {
      typescale: "body-sm",
      color: "$foreground",
      textTransform: "none",
    },
  },
};

export const DEFAULT_SECTION_TEMPLATES = {
  hero: DEFAULT_HERO_SECTION_TEMPLATE,
  description: DEFAULT_DESCRIPTION_SECTION_TEMPLATE,
  details: DEFAULT_DETAILS_SECTION_TEMPLATE,
  buttons: DEFAULT_BUTTONS_SECTION_TEMPLATE,
  impact: DEFAULT_IMPACT_SECTION_TEMPLATE,
  materials: DEFAULT_MATERIALS_SECTION_TEMPLATE,
  journey: DEFAULT_JOURNEY_SECTION_TEMPLATE,
  banner: DEFAULT_BANNER_SECTION_TEMPLATE,
  carousel: DEFAULT_CAROUSEL_SECTION_TEMPLATE,
} satisfies Record<SectionType, SectionTemplate>;

export const DEFAULT_PASSPORT_TEMPLATE = {
  version: 2,
  tokens: {
    colors: {
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
    },
    typography: {
      h1: {
        fontFamily: DEFAULT_PASSPORT_FONT_FAMILY,
        fontSize: 32,
        fontWeight: 600,
        lineHeight: 1.3,
        letterSpacing: 0,
      },
      h2: {
        fontFamily: DEFAULT_PASSPORT_FONT_FAMILY,
        fontSize: 28,
        fontWeight: 500,
        lineHeight: 1.3,
        letterSpacing: 0,
      },
      h3: {
        fontFamily: DEFAULT_PASSPORT_FONT_FAMILY,
        fontSize: 24,
        fontWeight: 500,
        lineHeight: 1.3,
        letterSpacing: 0,
      },
      h4: {
        fontFamily: DEFAULT_PASSPORT_FONT_FAMILY,
        fontSize: 21,
        fontWeight: 500,
        lineHeight: 1.3,
        letterSpacing: 0,
      },
      h5: {
        fontFamily: DEFAULT_PASSPORT_FONT_FAMILY,
        fontSize: 19,
        fontWeight: 500,
        lineHeight: 1.4,
        letterSpacing: 0,
      },
      h6: {
        fontFamily: DEFAULT_PASSPORT_FONT_FAMILY,
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.4,
        letterSpacing: 0,
      },
      body: {
        fontFamily: DEFAULT_PASSPORT_FONT_FAMILY,
        fontSize: 14,
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: 0,
      },
      "body-sm": {
        fontFamily: DEFAULT_PASSPORT_FONT_FAMILY,
        fontSize: 12,
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: 0,
      },
      "body-xs": {
        fontFamily: DEFAULT_PASSPORT_FONT_FAMILY,
        fontSize: 11,
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: 0,
      },
    },
    fonts: [
      {
        fontFamily: DEFAULT_PASSPORT_FONT_FAMILY,
        src: DEFAULT_PASSPORT_FONT_URL,
        fontWeight: "100 900",
        fontStyle: "normal",
        format: "woff2",
        fontDisplay: "swap",
      },
    ],
  },
  header: {
    logoUrl: "",
    styles: {
      container: { backgroundColor: "$background", borderColor: "$border" },
      textLogo: {
        color: "$foreground",
        textTransform: "none",
      },
    },
  },
  productImage: {
    styles: {
      frame: {
        borderColor: "$border",
        borderWidth: 0,
        borderRadius: 4,
      },
    },
  },
  footer: {
    social: {
      instagram: "",
      facebook: "",
      twitter: "",
      pinterest: "",
      tiktok: "",
      youtube: "",
      linkedin: "",
    },
    styles: {
      container: { backgroundColor: "$background", borderColor: "$border" },
      brandName: {
        typescale: "body-sm",
        color: "$mutedLightForeground",
        textTransform: "none",
      },
      socialIcon: {
        typescale: "body-sm",
        color: "$link",
        textTransform: "none",
      },
    },
  },
  sidebar: [
    { id: "sec_hero0001", ...DEFAULT_HERO_SECTION_TEMPLATE },
    { id: "sec_desc0001", ...DEFAULT_DESCRIPTION_SECTION_TEMPLATE },
    { id: "sec_deta0001", ...DEFAULT_DETAILS_SECTION_TEMPLATE },
    { id: "sec_butt0001", ...DEFAULT_BUTTONS_SECTION_TEMPLATE },
    { id: "sec_impa0001", ...DEFAULT_IMPACT_SECTION_TEMPLATE },
    { id: "sec_mate0001", ...DEFAULT_MATERIALS_SECTION_TEMPLATE },
    { id: "sec_jour0001", ...DEFAULT_JOURNEY_SECTION_TEMPLATE },
  ],
  canvas: [],
} satisfies Passport;

export function createDefaultPassport(): Passport {
  // Return a fresh copy so callers can safely mutate the default template.
  return structuredClone(DEFAULT_PASSPORT_TEMPLATE);
}
