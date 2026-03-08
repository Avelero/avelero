import type { Passport } from "@v1/dpp-components";

/**
 * Default Passport for new brands.
 *
 * Color values in styles use token references ("$tokenName"):
 * - "$foreground" → tokens.colors.foreground
 * - "$primary" → tokens.colors.primary
 * - Resolved at render time by resolveStyles()
 *
 * When a user explicitly overrides a color, it becomes a hex value.
 */
export const DEFAULT_PASSPORT: Passport = {
  version: 2,
  tokens: {
    colors: {
      background: "#FFFFFF",
      foreground: "#1E2040",
      muted: "#F8F8F9",
      mutedForeground: "#62637A",
      card: "#FFFFFF",
      cardForeground: "#1E2040",
      primary: "#0000FF",
      primaryForeground: "#FFFFFF",
      destructive: "#EDCDCD",
      destructiveForeground: "#A40303",
      success: "#CEEDDF",
      successForeground: "#03A458",
      border: "#E8E9EC",
      link: "#0000FF",
    },
    typography: {
      h1: {
        fontFamily: "Geist",
        fontSize: 48,
        fontWeight: 500,
        lineHeight: 1,
        letterSpacing: -0.4,
      },
      h2: {
        fontFamily: "Geist",
        fontSize: 40,
        fontWeight: 500,
        lineHeight: 1,
        letterSpacing: -0.4,
      },
      h3: {
        fontFamily: "Geist",
        fontSize: 33,
        fontWeight: 500,
        lineHeight: 1,
        letterSpacing: -0.4,
      },
      h4: {
        fontFamily: "Geist",
        fontSize: 28,
        fontWeight: 500,
        lineHeight: 1,
        letterSpacing: -0.4,
      },
      h5: {
        fontFamily: "Geist",
        fontSize: 23,
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: 0,
      },
      h6: {
        fontFamily: "Geist",
        fontSize: 19,
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: 0,
      },
      body: {
        fontFamily: "Geist",
        fontSize: 16,
        fontWeight: 400,
        lineHeight: 1.25,
        letterSpacing: 0,
      },
      "body-sm": {
        fontFamily: "Geist",
        fontSize: 14,
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: 0,
      },
      "body-xs": {
        fontFamily: "Geist",
        fontSize: 12,
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: 0,
      },
    },
  },

  header: {
    logoUrl: "",
    styles: {
      container: { backgroundColor: "$background" },
      textLogo: { color: "$foreground" },
    },
  },

  footer: {
    social: {},
    styles: {
      container: { backgroundColor: "$background" },
      brandName: { typescale: "body-sm", color: "$mutedForeground" },
      socialIcon: { typescale: "body-sm", color: "$link" },
    },
  },

  sidebar: [
    {
      id: "sec_hero0001",
      type: "hero",
      content: {},
      styles: {
        brand: {
          typescale: "body-sm",
          color: "$mutedForeground",
          textTransform: "uppercase",
        },
        title: { typescale: "h3", color: "$foreground" },
        description: { typescale: "body", color: "$foreground" },
        showMore: {
          typescale: "body-xs",
          color: "$mutedForeground",
          textTransform: "uppercase",
        },
      },
    },
    {
      id: "sec_deta0001",
      type: "details",
      content: {},
      styles: {
        container: { borderColor: "$border" },
        label: { typescale: "body-sm", color: "$foreground" },
        value: { typescale: "body-sm", color: "$foreground" },
      },
    },
    {
      id: "sec_impa0001",
      type: "impact",
      content: {},
      styles: {
        title: { typescale: "h6", color: "$foreground" },
        card: {
          backgroundColor: "$card",
          borderColor: "$border",
          borderRadius: 0,
        },
        "card.icon": { color: "$primary", size: 32 },
        "card.type": { typescale: "body-sm", color: "$mutedForeground" },
        "card.value": { typescale: "h4", color: "$cardForeground" },
        "card.unit": { typescale: "body-sm", color: "$mutedForeground" },
      },
    },
    {
      id: "sec_mate0001",
      type: "materials",
      content: { showCertificationCheckIcon: true },
      styles: {
        title: { typescale: "h6", color: "$foreground" },
        card: { borderColor: "$border" },
        "card.percentage": { typescale: "h5", color: "$foreground" },
        "card.type": { typescale: "body-sm", color: "$foreground" },
        "card.origin": { typescale: "body-xs", color: "$mutedForeground" },
        "card.certification": {
          typescale: "body-xs",
          color: "$successForeground",
          backgroundColor: "$success",
          borderRadius: 2,
        },
        "card.certIcon": { color: "$successForeground", size: 12 },
        "card.certText": { typescale: "body-xs", color: "$mutedForeground" },
      },
    },
    {
      id: "sec_jour0001",
      type: "journey",
      content: {},
      styles: {
        title: { typescale: "h6", color: "$foreground" },
        card: { borderColor: "$border" },
        "card.type": { typescale: "body-sm", color: "$foreground" },
        "card.operator": { typescale: "body-xs", color: "$mutedForeground" },
        "card.line": { backgroundColor: "$border" },
      },
    },
  ],

  canvas: [],
};
