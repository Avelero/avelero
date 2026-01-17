import type { ThemeStyles, ThemeConfig } from "@v1/dpp-components";

/**
 * Default ThemeStyles for new brands.
 *
 * COLOR VALUES USE TOKEN REFERENCES:
 * - Colors that should cascade from the design system use "$tokenName" syntax
 * - Example: "$foreground" references the "foreground" color from colors.foreground
 * - When CSS is generated, "$foreground" becomes "var(--foreground)"
 * - This allows design token changes to cascade to all components using that token
 *
 * EXPLICIT OVERRIDES:
 * - When a user explicitly sets a component color, it becomes a hex value like "#FF0000"
 * - Hex values are output directly and don't cascade from design tokens
 *
 * Design token references:
 * - $background → colors.background
 * - $foreground → colors.foreground
 * - $muted → colors.muted
 * - $mutedForeground → colors.mutedForeground
 * - $card → colors.card
 * - $cardForeground → colors.cardForeground
 * - $primary → colors.primary
 * - $primaryForeground → colors.primaryForeground
 * - $success → colors.success
 * - $successForeground → colors.successForeground
 * - $border → colors.border
 * - $link → colors.link
 */
export const DEFAULT_THEME_STYLES: ThemeStyles = {
  // ===========================================================================
  // DESIGN TOKENS
  // ===========================================================================
  colors: {
    background: "#FFFFFF",
    foreground: "#1E2040",
    muted: "#F8F8F9",
    mutedForeground: "#62637A",
    accent: "#F8F8F9",
    accentForeground: "#1E2040",
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
      fontSize: 48, // 3rem
      fontWeight: 500,
      lineHeight: 1,
      letterSpacing: "-0.025em",
    },
    h2: {
      fontFamily: "Geist",
      fontSize: 40, // 2.5rem
      fontWeight: 500,
      lineHeight: 1,
      letterSpacing: "-0.025em",
    },
    h3: {
      fontFamily: "Geist",
      fontSize: 33, // 2.0625rem
      fontWeight: 500,
      lineHeight: 1,
      letterSpacing: "-0.025em",
    },
    h4: {
      fontFamily: "Geist",
      fontSize: 28, // 1.755rem
      fontWeight: 500,
      lineHeight: 1,
      letterSpacing: "-0.025em",
    },
    h5: {
      fontFamily: "Geist",
      fontSize: 23, // 1.4375rem
      fontWeight: 500,
      lineHeight: 1.25,
      letterSpacing: "0em",
    },
    h6: {
      fontFamily: "Geist",
      fontSize: 19, // 1.1875rem
      fontWeight: 500,
      lineHeight: 1.25,
      letterSpacing: "0em",
    },
    body: {
      fontFamily: "Geist",
      fontSize: 16, // 1rem
      fontWeight: 400,
      lineHeight: 1.25,
      letterSpacing: "0em",
    },
    "body-sm": {
      fontFamily: "Geist",
      fontSize: 14, // 0.875rem
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: "0em",
    },
    "body-xs": {
      fontFamily: "Geist",
      fontSize: 12, // 0.75rem
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: "0em",
    },
  },

  // ===========================================================================
  // HEADER
  // Fallbacks: backgroundColor → background, borderColor → border
  // ===========================================================================
  header: {
    borderColor: "$border",
    backgroundColor: "$background",
  },

  // ===========================================================================
  // FOOTER
  // Fallbacks: backgroundColor → background, borderColor → border
  // ===========================================================================
  footer: {
    borderColor: "$border",
    backgroundColor: "$background",
  },
  "footer__legal-name": {
    color: "$mutedForeground",
    typescale: "body-sm",
    textTransform: "none",
  },
  "footer__social-icons": {
    color: "$link",
    typescale: "body-sm",
  },

  // ===========================================================================
  // PRODUCT
  // ===========================================================================
  product__image: {
    borderColor: "$border",
    borderRadius: 0,
  },
  product__title: {
    color: "$foreground",
    typescale: "h5",
    textTransform: "uppercase",
  },
  product__description: {
    color: "$mutedForeground",
    typescale: "body-sm",
    textTransform: "none",
  },
  product__brand: {
    color: "$foreground",
    typescale: "body-sm",
    textTransform: "uppercase",
  },
  "product__show-more": {
    color: "$link",
  },

  // ===========================================================================
  // PRODUCT DETAILS
  // Fallbacks: borderColor → border, backgroundColor → card
  // ===========================================================================
  "product-details": {
    borderColor: "$border",
    borderRadius: 0,
    backgroundColor: "$card",
  },
  "product-details__label": {
    color: "$cardForeground",
    typescale: "body-sm",
    textTransform: "uppercase",
  },
  "product-details__value": {
    color: "$mutedForeground",
    typescale: "body-sm",
    textTransform: "none",
  },

  // ===========================================================================
  // PRIMARY MENU
  // Fallbacks: borderColor → border, backgroundColor → background, color → foreground
  // ===========================================================================
  "menu-primary-button": {
    borderColor: "$border",
    backgroundColor: "$background",
    color: "$foreground",
    typescale: "body",
    textTransform: "uppercase",
  },
  "menu-primary-button__icon": {
    color: "$foreground",
    size: 20,
  },

  // ===========================================================================
  // SECONDARY MENU
  // Fallbacks: borderColor → border, backgroundColor → background, color → foreground
  // ===========================================================================
  "menu-secondary-button": {
    borderColor: "$border",
    backgroundColor: "$background",
    color: "$foreground",
    typescale: "body",
    textTransform: "uppercase",
  },
  "menu-secondary-button__icon": {
    color: "$foreground",
    size: 20,
  },

  // ===========================================================================
  // IMPACT
  // Fallbacks: borderColor → border, backgroundColor → card
  // ===========================================================================
  "impact-card": {
    borderColor: "$border",
    borderRadius: 0,
    backgroundColor: "$card",
  },
  "impact-card__title": {
    color: "$foreground",
    typescale: "h6",
    textTransform: "uppercase",
  },
  "impact-card__type": {
    color: "$mutedForeground",
    typescale: "body-xs",
    textTransform: "uppercase",
  },
  "impact-card__value": {
    color: "$cardForeground",
    typescale: "h1",
  },
  "impact-card__unit": {
    color: "$mutedForeground",
    typescale: "body-xs",
    textTransform: "none",
  },
  "impact-card__icon": {
    color: "$mutedForeground",
    size: 28,
  },

  // ===========================================================================
  // MATERIALS
  // Fallbacks: borderColor → border, backgroundColor → card
  // ===========================================================================
  "materials-card": {
    borderColor: "$border",
    borderRadius: 0,
    backgroundColor: "$card",
  },
  "materials-card__title": {
    color: "$foreground",
    typescale: "h6",
    textTransform: "uppercase",
  },
  "materials-card__percentage": {
    color: "$cardForeground",
    typescale: "body",
    textTransform: "none",
  },
  "materials-card__type": {
    color: "$cardForeground",
    typescale: "body",
    textTransform: "uppercase",
  },
  "materials-card__certification": {
    color: "$successForeground",
    backgroundColor: "$success",
    borderRadius: 4,
    borderColor: "transparent",
    typescale: "body-xs",
    textTransform: "none",
  },
  "materials-card__certification-icon": {
    color: "$successForeground",
    size: 12,
  },
  "materials-card__origin": {
    color: "$mutedForeground",
    typescale: "body-xs",
    textTransform: "none",
  },
  "materials-card__certification-text": {
    color: "$link",
    typescale: "body-xs",
    textTransform: "uppercase",
  },

  // ===========================================================================
  // JOURNEY
  // Fallbacks: borderColor → border, backgroundColor → card
  // ===========================================================================
  "journey-card": {
    borderColor: "$border",
    borderRadius: 0,
    backgroundColor: "$card",
  },
  "journey-card__title": {
    color: "$foreground",
    typescale: "h6",
    textTransform: "uppercase",
  },
  "journey-card__line": {
    backgroundColor: "$mutedForeground",
  },
  "journey-card__type": {
    color: "$cardForeground",
    typescale: "body",
    textTransform: "uppercase",
  },
  "journey-card__operator": {
    color: "$mutedForeground",
    typescale: "body-xs",
    textTransform: "none",
  },

  // ===========================================================================
  // CAROUSEL
  // ===========================================================================
  carousel__title: {
    color: "$foreground",
    typescale: "h6",
    textTransform: "uppercase",
  },
  "carousel__nav-button": {
    borderColor: "$primary",
    backgroundColor: "transparent",
    color: "$primary",
    borderRadius: 0,
  },
  "carousel__nav-button-icon": {
    size: 16,
  },
  "carousel__product-image": {
    borderColor: "$border",
    borderWidth: { top: 0, right: 0, bottom: 0, left: 0 },
    borderRadius: 0,
  },
  "carousel__product-details": {
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "flex-start",
  },
  "carousel__product-name": {
    color: "$link",
    typescale: "body",
    textTransform: "uppercase",
  },
  "carousel__product-price": {
    color: "$foreground",
    typescale: "body",
    textTransform: "none",
  },

  // ===========================================================================
  // BANNER
  // Fallbacks: backgroundColor → background, borderColor → border
  // ===========================================================================
  banner: {
    backgroundColor: "$background",
    borderColor: "$border",
    borderWidth: { top: 0, right: 0, bottom: 0, left: 0 },
    borderRadius: 0,
  },
  banner__container: {
    alignItems: "center",
    justifyContent: "center",
  },
  banner__headline: {
    color: "$primaryForeground",
    typescale: "h3",
    textTransform: "none",
    textAlign: "center",
  },
  banner__subline: {
    color: "$primaryForeground",
    typescale: "h5",
    textTransform: "none",
    textAlign: "center",
  },
  banner__button: {
    color: "$primaryForeground",
    backgroundColor: "$primary",
    borderColor: "$primary",
    borderWidth: { top: 0, right: 0, bottom: 0, left: 0 },
    borderRadius: 0,
    typescale: "body-sm",
    textTransform: "uppercase",
  },
};

/**
 * Default ThemeConfig for new brands.
 */
export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  branding: {
    headerLogoUrl: "",
  },
  menus: {
    primary: [],
    secondary: [],
  },
  cta: {
    bannerBackgroundImage: "",
    bannerHeadline: "",
    bannerSubline: "",
    bannerCTAText: "",
    bannerCTAUrl: "",
    showHeadline: true,
    showSubline: true,
    showButton: true,
  },
  social: {
    showInstagram: false,
    showFacebook: false,
    showTwitter: false,
    showPinterest: false,
    showTiktok: false,
    showLinkedin: false,
    instagramUrl: "",
    facebookUrl: "",
    twitterUrl: "",
    pinterestUrl: "",
    tiktokUrl: "",
    linkedinUrl: "",
  },
  sections: {
    showProductDetails: true,
    showPrimaryMenu: false,
    showSecondaryMenu: false,
    showImpact: true,
    showMaterials: true,
    showJourney: true,
    showSimilarProducts: false,
    showCTABanner: false,
  },
  materials: {
    showCertificationCheckIcon: true,
  },
  carousel: {
    productCount: 4,
    showPrice: true,
    showTitle: true,
    roundPrice: true,
  },
};
