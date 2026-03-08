/**
 * Canonical default passport helpers.
 *
 * Keeps the seeded brand passport and the public demo passport aligned so they
 * are generated from the same source of truth.
 */

import { BUTTONS_SCHEMA } from "../sections/buttons/schema";
import { DESCRIPTION_SCHEMA } from "../sections/description/schema";
import { DETAILS_SCHEMA } from "../sections/details/schema";
import { HERO_SCHEMA } from "../sections/hero/schema";
import { IMPACT_SCHEMA } from "../sections/impact/schema";
import { JOURNEY_SCHEMA } from "../sections/journey/schema";
import { MATERIALS_SCHEMA } from "../sections/materials/schema";
import type { SectionSchema } from "../sections/registry";
import type { Passport, Section, SocialLinks, Styles } from "../types/passport";
import {
  DEFAULT_PASSPORT_FONT,
  DEFAULT_PASSPORT_FONT_FAMILY,
} from "./default-fonts";
import { createDefaultProductImage } from "./default-product-image";

const DEFAULT_SOCIAL_LINKS: SocialLinks = {
  instagram: "",
  facebook: "",
  twitter: "",
  pinterest: "",
  tiktok: "",
  youtube: "",
  linkedin: "",
};

const DEFAULT_HEADER_STYLES: Styles = {
  container: { backgroundColor: "$background", borderColor: "$border" },
  textLogo: {
    color: "$foreground",
    textTransform: "none",
  },
};

const DEFAULT_FOOTER_STYLES: Styles = {
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
};

const DEFAULT_TYPOGRAPHY: Passport["tokens"]["typography"] = {
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
};

const DEFAULT_SIDEBAR_SCHEMAS: Array<{ id: string; schema: SectionSchema }> = [
  { id: "sec_hero0001", schema: HERO_SCHEMA },
  { id: "sec_desc0001", schema: DESCRIPTION_SCHEMA },
  { id: "sec_deta0001", schema: DETAILS_SCHEMA },
  { id: "sec_butt0001", schema: BUTTONS_SCHEMA },
  { id: "sec_impa0001", schema: IMPACT_SCHEMA },
  { id: "sec_mate0001", schema: MATERIALS_SCHEMA },
  { id: "sec_jour0001", schema: JOURNEY_SCHEMA },
];

function createSectionFromSchema(id: string, schema: SectionSchema): Section {
  // Build a fresh section instance from schema defaults so editor fields are hydrated.
  return {
    id,
    type: schema.type,
    content: structuredClone(schema.defaultContent),
    styles: structuredClone(schema.defaultStyles),
  };
}

function createDefaultSidebarSections(): Section[] {
  // Build the default sidebar layout in the exact order new brands start with.
  return DEFAULT_SIDEBAR_SCHEMAS.map(({ id, schema }) =>
    createSectionFromSchema(id, schema),
  );
}

export function createDefaultPassport(): Passport {
  // Build a fresh passport object so callers never share mutable default state.
  return {
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
      typography: structuredClone(DEFAULT_TYPOGRAPHY),
      fonts: [{ ...DEFAULT_PASSPORT_FONT }],
    },
    header: {
      logoUrl: "",
      styles: structuredClone(DEFAULT_HEADER_STYLES),
    },
    productImage: createDefaultProductImage(),
    footer: {
      social: structuredClone(DEFAULT_SOCIAL_LINKS),
      styles: structuredClone(DEFAULT_FOOTER_STYLES),
    },
    sidebar: createDefaultSidebarSections(),
    canvas: [],
  };
}
