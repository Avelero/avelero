import type { ThemeConfig } from "@v1/dpp-components";

/**
 * Demo theme configuration for Avelero Apparel
 * Uses default styling (no theme-styles override)
 */
export const demoThemeConfig: ThemeConfig = {
  layout: {
    version: 1,
    zones: {
      "column-left": [
        { id: "inst_img_1", componentType: "image" },
      ],
      "column-right": [
        { id: "inst_hero_1", componentType: "hero" },
        { id: "inst_det_1", componentType: "details" },
        {
          id: "inst_btn_1",
          componentType: "buttons",
          content: {
            items: [
              { label: "Care Instructions", url: "https://avelero.com" },
              { label: "Recycling & Repair", url: "https://avelero.com" },
              { label: "Warranty", url: "https://avelero.com" },
            ],
            variant: "primary",
          },
        },
        { id: "inst_imp_1", componentType: "impact" },
        { id: "inst_mat_1", componentType: "materials" },
        { id: "inst_jrn_1", componentType: "journey" },
        {
          id: "inst_btn_2",
          componentType: "buttons",
          content: {
            items: [{ label: "Compliance", url: "https://avelero.com" }],
            variant: "secondary",
          },
        },
      ],
      content: [
        {
          id: "inst_ban_1",
          componentType: "banner",
          content: {
            backgroundImage:
              "https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745934275/cta-banner-background_o3vjjw.jpg",
            headline: "Avelero Apparel",
            subline: "",
            ctaText: "DISCOVER MORE",
            ctaUrl: "https://avelero.com",
            showHeadline: true,
            showSubline: true,
            showButton: true,
          },
        },
      ],
    },
  },

  branding: {
    headerLogoUrl:
      "https://res.cloudinary.com/dcdam15xy/image/upload/f_webp/v1746526939/aveleroApparelLogoBlack_iuhow7.png",
  },

  menus: {
    primary: [
      { label: "Care Instructions", url: "https://avelero.com" },
      { label: "Recycling & Repair", url: "https://avelero.com" },
      { label: "Warranty", url: "https://avelero.com" },
    ],
    secondary: [{ label: "Compliance", url: "https://avelero.com" }],
  },

  cta: {
    bannerBackgroundImage:
      "https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745934275/cta-banner-background_o3vjjw.jpg",
    bannerHeadline: "Avelero Apparel",
    bannerSubline: "",
    bannerCTAText: "DISCOVER MORE",
    bannerCTAUrl: "https://avelero.com",
    showHeadline: true,
    showSubline: true,
    showButton: true,
  },

  social: {
    showInstagram: false,
    showFacebook: false,
    showTwitter: true,
    showPinterest: false,
    showTiktok: false,
    showYoutube: false,
    showLinkedin: true,
    instagramUrl: "",
    facebookUrl: "",
    twitterUrl: "https://x.com/avelerodpp",
    pinterestUrl: "",
    tiktokUrl: "",
    youtubeUrl: "",
    linkedinUrl: "https://www.linkedin.com/company/avelero",
  },

  sections: {
    showProductDetails: true,
    showPrimaryMenu: true,
    showSecondaryMenu: true,
    showImpact: true,
    showMaterials: true,
    showJourney: true,
    showSimilarProducts: true,
    showCTABanner: true,
  },

  materials: {
    showCertificationCheckIcon: true,
  },

  carousel: {
    productCount: 6,
    showPrice: true,
    showTitle: true,
    roundPrice: true,
  },
};
