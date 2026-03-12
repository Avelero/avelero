/**
 * Demo passport for the public passport.avelero.com demo page.
 *
 * Self-contained with inline demo content and a demo-specific layout.
 * Shares styles from schema defaults and tokens from default-tokens.
 */

import {
  COMPONENT_REGISTRY,
  MODAL_SCHEMA_REGISTRY,
} from "../../components/layout/registry";
import { SECTION_REGISTRY } from "../../sections/registry";
import type {
  Passport,
  Section,
  SectionType,
  SocialLinks,
} from "../../types/passport";
import {
  DEFAULT_COLORS,
  DEFAULT_FONTS,
  DEFAULT_TYPOGRAPHY,
} from "../defaults/tokens";

const bannerDemoDefaults = structuredClone(
  SECTION_REGISTRY.banner.schema.defaults,
);

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
const modalDefaults = MODAL_SCHEMA_REGISTRY.modal!.schema.defaults;
const footerDefaults = COMPONENT_REGISTRY.footer!.schema.defaults;

export const DEMO_PASSPORT: Passport = {
  version: 2,
  tokens: {
    colors: structuredClone(DEFAULT_COLORS),
    typography: structuredClone(DEFAULT_TYPOGRAPHY),
    fonts: structuredClone(DEFAULT_FONTS),
  },
  header: {
    logoUrl:
      "https://storage.avelero.com/storage/v1/object/public/dpp-assets/system/header-logo/logo-demo.svg",
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
      showCertificationCheckIcon: false,
    }),
    demoSection("journey", "sec_jour0001", {}),
  ],
  canvas: [
    demoSection("separator", "sec_sepa0001", {}),
    demoSection("textImage", "sec_txti0001", {
      headline: "B Corp Certified",
      body: [
        "Since 2024, we've been a certified B Corporation, meeting verified standards across governance, workers, community, environment, and customers. It's not a label we put on ourselves. It's an independent assessment of how we run this company.",
        "Being part of the B Corp community keeps us accountable and connected to brands that take the same things seriously.",
        "Read more at bcorporation.net/find-a-b-corp/company/avelero-apparel",
      ].join("\n\n"),
      image:
        "https://storage.avelero.com/storage/v1/object/public/dpp-assets/system/text-image/text-image-demo-one.webp",
      imageAlt: "Avelero Apparel sustainability certification campaign image",
      imagePosition: "right",
      mobileLayout: "split",
    }),
    demoSection("textImage", "sec_txti0002", {
      headline: "Why we share this",
      body: [
        "Every material choice, every factory partnership, every certification we hold is documented here. Not because regulation requires it, but because we think you should be able to see exactly what goes into what you wear.",
        "This passport is built with Avelero, so the information stays structured, verifiable, and easy to explore.",
        "Read more at avelero.com",
      ].join("\n\n"),
      image:
        "https://storage.avelero.com/storage/v1/object/public/dpp-assets/system/text-image/text-image-demo-two.webp",
      imageAlt: "Avelero Apparel documentation and reporting campaign image",
      imagePosition: "left",
      mobileLayout: "split",
    }),
    demoSection("imageCards", "sec_feat0001", {
      title: "Latest",
      cardOneImage:
        "https://storage.avelero.com/storage/v1/object/public/dpp-assets/system/image-cards/image-card-demo-one.webp",
      cardOneImageAlt: "Metal chain necklace on a pink textured background",
      cardOneHeading: "Design for longevity",
      cardOneBody:
        "We design for years, not seasons. Every product is tested for durability and built to be repaired, resold, or recycled at end of life.",
      cardOneUrl: "https://avelero.com/",
      cardTwoImage:
        "https://storage.avelero.com/storage/v1/object/public/dpp-assets/system/image-cards/image-card-demo-two.webp",
      cardTwoImageAlt: "Model wearing a light denim outfit on a runway",
      cardTwoHeading: "Preferred materials",
      cardTwoBody:
        "72% of our current collection uses organic, recycled, or responsibly sourced materials. We're on track for 100% by 2027.",
      cardTwoUrl: "https://avelero.com/",
      cardThreeImage:
        "https://storage.avelero.com/storage/v1/object/public/dpp-assets/system/image-cards/image-card-demo-three.webp",
      cardThreeImageAlt: "Textured yellow bag against a purple backdrop",
      cardThreeHeading: "Low impact production",
      cardThreeBody:
        "Our Tier 1 and Tier 2 suppliers are audited annually. We've cut water use by 35% since 2022 and eliminated all hazardous chemicals.",
      cardThreeUrl: "https://avelero.com/",
    }),
    demoSection("banner", "sec_bann0001", {
      headline: "See the full picture",
      subline:
        "Certifications, policies, and supply chain details for this product.",
      ctaText: "View Compliance",
      ctaUrl: "https://avelero.com/",
      backgroundImage:
        "https://storage.avelero.com/storage/v1/object/public/dpp-assets/system/banner/banner-demo.webp",
    }),
  ],
};

DEMO_PASSPORT.canvas[DEMO_PASSPORT.canvas.length - 1]!.styles = {
  ...bannerDemoDefaults.styles,
  headline: {
    ...(bannerDemoDefaults.styles.headline as Record<string, unknown>),
    color: "#FFFFFF",
  },
  subline: {
    ...(bannerDemoDefaults.styles.subline as Record<string, unknown>),
    color: "#FFFFFF",
  },
};

export function createDemoPassport(): Passport {
  return structuredClone(DEMO_PASSPORT);
}
