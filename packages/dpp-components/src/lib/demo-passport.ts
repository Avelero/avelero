/**
 * Demo passport for the public passport.avelero.com demo page.
 *
 * Self-contained with inline demo content and a demo-specific layout.
 * Shares styles from schema defaults and tokens from default-tokens.
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

/** Create a demo section: styles from schema defaults, custom inline content. */
function demoSection(
  type: SectionType,
  id: string,
  content: Record<string, unknown>,
): Section {
  return {
    id,
    type,
    content,
    styles: structuredClone(SECTION_REGISTRY[type].schema.defaults.styles),
  };
}

const headerDefaults = COMPONENT_REGISTRY.header!.schema.defaults;
const productImageDefaults = COMPONENT_REGISTRY.productImage!.schema.defaults;
const modalDefaults = COMPONENT_REGISTRY.modal!.schema.defaults;
const footerDefaults = COMPONENT_REGISTRY.footer!.schema.defaults;

export const DEMO_PASSPORT: Passport = {
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
    demoSection("hero", "sec_hero0001", {}),
    demoSection("description", "sec_desc0001", {}),
    demoSection("details", "sec_deta0001", {}),
    demoSection("buttons", "sec_butt0001", {
      variant: "primary",
      menuItems: [
        { label: "Care Instructions", url: "https://avelero.com/" },
        { label: "Recycling & Repair", url: "https://avelero.com/" },
        { label: "Warranty", url: "https://avelero.com/" },
      ],
    }),
    demoSection("impact", "sec_impa0001", {}),
    demoSection("materials", "sec_mate0001", {
      showCertificationCheckIcon: true,
    }),
    demoSection("journey", "sec_jour0001", {}),
  ],
  canvas: [],
};

export function createDemoPassport(): Passport {
  return structuredClone(DEMO_PASSPORT);
}
