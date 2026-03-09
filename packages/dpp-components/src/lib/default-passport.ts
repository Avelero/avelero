/**
 * Default brand passport.
 *
 * Assembles sections from SECTION_REGISTRY schema defaults and fixed components
 * from COMPONENT_REGISTRY schema defaults. Only defines layout order — all style
 * and content values come from the registries.
 *
 * Used when a new brand is created.
 */

import { COMPONENT_REGISTRY } from "../components/layout/registry";
import { SECTION_REGISTRY } from "../sections/registry";
import type {
  Passport,
  Section,
  SectionType,
  SocialLinks,
} from "../types/passport";
import {
  DEFAULT_COLORS,
  DEFAULT_FONTS,
  DEFAULT_TYPOGRAPHY,
} from "./default-tokens";

function createSection(type: SectionType, id: string): Section {
  const { defaults } = SECTION_REGISTRY[type].schema;
  return {
    id,
    type,
    content: structuredClone(defaults.content),
    styles: structuredClone(defaults.styles),
  };
}

const headerDefaults = COMPONENT_REGISTRY.header!.schema.defaults;
const productImageDefaults = COMPONENT_REGISTRY.productImage!.schema.defaults;
const modalDefaults = COMPONENT_REGISTRY.modal!.schema.defaults;
const footerDefaults = COMPONENT_REGISTRY.footer!.schema.defaults;

export const DEFAULT_PASSPORT: Passport = {
  version: 2,
  tokens: {
    colors: structuredClone(DEFAULT_COLORS),
    typography: structuredClone(DEFAULT_TYPOGRAPHY),
    fonts: structuredClone(DEFAULT_FONTS),
  },
  header: {
    logoUrl: (headerDefaults.content.logoUrl as string) ?? "",
    styles: structuredClone(headerDefaults.styles),
  },
  productImage: {
    styles: structuredClone(productImageDefaults.styles),
  },
  modal: {
    content: structuredClone(
      modalDefaults.content,
    ) as Passport["modal"]["content"],
    styles: structuredClone(modalDefaults.styles),
  },
  footer: {
    social: structuredClone(footerDefaults.content.social) as SocialLinks,
    styles: structuredClone(footerDefaults.styles),
  },
  sidebar: [
    createSection("hero", "sec_hero0001"),
    createSection("description", "sec_desc0001"),
    createSection("details", "sec_deta0001"),
    createSection("buttons", "sec_butt0001"),
    createSection("impact", "sec_impa0001"),
    createSection("materials", "sec_mate0001"),
    createSection("journey", "sec_jour0001"),
  ],
  canvas: [],
};

export function createDefaultPassport(): Passport {
  return structuredClone(DEFAULT_PASSPORT);
}
