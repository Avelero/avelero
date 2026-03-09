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
  canvas: [
    demoSection("separator", "sec_sepa0001", {}),
    demoSection("textImage", "sec_txti0001", {
      headline: "B Corp Certification",
      body: [
        "Avelero Apparel achieved B Corp Certification in 2024, recognizing our commitment to high standards of social and environmental performance, transparency, and accountability.",
        "This certification connects us to a global community of like-minded organizations working to build a more responsible fashion industry.",
        "Read more at bcorporation.net/find-a-b-corp/company/avelero-apparel",
      ].join("\n\n"),
      image:
        "https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937032/AIModelTwo_vglkse.webp",
      imageAlt: "Avelero Apparel sustainability certification campaign image",
      imagePosition: "right",
      mobileLayout: "split",
    }),
    demoSection("textImage", "sec_txti0002", {
      headline: "Documenting our work",
      body: [
        "We collect our product, material, and manufacturing data in a way that makes sustainability progress easier to understand and share.",
        "That means the passport can present the work clearly, instead of burying it in a generic compliance layout.",
        "Read more at avelero.com",
      ].join("\n\n"),
      image:
        "https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937032/AIModelThree_klgnyi.webp",
      imageAlt: "Avelero Apparel documentation and reporting campaign image",
      imagePosition: "left",
      mobileLayout: "split",
    }),
    demoSection("featureCards", "sec_feat0001", {
      title: "Latest",
      cardOneImage: "/passport-menu-image.webp",
      cardOneImageAlt: "Metal chain necklace on a pink textured background",
      cardOneHeading: "Design for longevity",
      cardOneBody:
        "Every product is designed with its full lifecycle in mind, from wear and repair to reuse and recycling.",
      cardOneUrl: "https://avelero.com/",
      cardTwoImage: "/passport-banner-image.webp",
      cardTwoImageAlt: "Model wearing a light denim outfit on a runway",
      cardTwoHeading: "Preferred materials",
      cardTwoBody:
        "Around 70% of our collection uses organic, recycled, or responsibly sourced materials, heading to 100%.",
      cardTwoUrl: "https://avelero.com/",
      cardThreeImage: "/passport-carousel-image.webp",
      cardThreeImageAlt: "Textured yellow bag against a purple backdrop",
      cardThreeHeading: "Low impact production",
      cardThreeBody:
        "We reduce water, chemicals, and energy across production through certified partners and clean techniques.",
      cardThreeUrl: "https://avelero.com/",
    }),
    demoSection("banner", "sec_bann0001", {
      headline: "Explore Our Sustainability Commitments",
      subline:
        "Read more about the standards, certifications, and policies behind this product.",
      ctaText: "View Compliance",
      ctaUrl: "https://avelero.com/",
      backgroundImage: "",
    }),
  ],
};

export function createDemoPassport(): Passport {
  return structuredClone(DEMO_PASSPORT);
}
