import type { ThemeStyles, ThemeConfig } from "@v1/dpp-components";

/**
 * Default ThemeStyles for new brands.
 * 
 * IMPORTANT: These values MUST match the CSS defaults in globals.css.
 * When updating globals.css defaults, update this file as well.
 * 
 * Color references resolved:
 * - --background: #FFFFFF
 * - --foreground: #1E2040
 * - --primary: #1E2040
 * - --secondary: #62637A
 * - --border: #E9E9EC
 * - --link: #0000FF
 * - --highlight: #0000FF
 * - --highlight-foreground: #FFFFFF
 * - --success: #CDEDDE
 * - --success-foreground: #03A458
 */
export const DEFAULT_THEME_STYLES: ThemeStyles = {
  // ===========================================================================
  // DESIGN TOKENS
  // ===========================================================================
  colors: {
    background: "#FFFFFF",
    foreground: "#1E2040",
    primary: "#1E2040",
    secondary: "#62637A",
    accent: "#F8F8F9",
    highlight: "#0000FF",
    success: "#CDEDDE",
    successForeground: "#03A458",
    border: "#E9E9EC",
    link: "#0000FF",
  },
  typography: {
    h1: { fontFamily: "Geist", fontSize: 32, fontWeight: 500, lineHeight: 1, letterSpacing: "-0.02em" },
    h2: { fontFamily: "Geist", fontSize: 29, fontWeight: 500, lineHeight: 1, letterSpacing: "-0.01em" },
    h3: { fontFamily: "Geist", fontSize: 26, fontWeight: 500, lineHeight: 1.1, letterSpacing: "-0.01em" },
    h4: { fontFamily: "Geist", fontSize: 23, fontWeight: 500, lineHeight: 1.1, letterSpacing: "-0.01em" },
    h5: { fontFamily: "Geist", fontSize: 20, fontWeight: 500, lineHeight: 1.2, letterSpacing: "0em" },
    h6: { fontFamily: "Geist", fontSize: 18, fontWeight: 500, lineHeight: 1.25, letterSpacing: "0em" },
    body: { fontFamily: "Geist", fontSize: 16, fontWeight: 400, lineHeight: 1.25, letterSpacing: "0em" },
    "body-sm": { fontFamily: "Geist", fontSize: 14, fontWeight: 400, lineHeight: 1.5, letterSpacing: "0em" },
    "body-xs": { fontFamily: "Geist", fontSize: 12, fontWeight: 400, lineHeight: 1.4, letterSpacing: "0em" },
  },

  // ===========================================================================
  // HEADER
  // ===========================================================================
  header: {
    borderColor: "#E9E9EC",
    backgroundColor: "#FFFFFF",
  },

  // ===========================================================================
  // FOOTER
  // ===========================================================================
  footer: {
    borderColor: "#E9E9EC",
    backgroundColor: "#FFFFFF",
  },
  "footer__legal-name": {
    color: "#62637A",
    typescale: "body-sm",
    textTransform: "none",
  },
  "footer__social-icons": {
    color: "#0000FF",
    typescale: "body-sm",
  },

  // ===========================================================================
  // PRODUCT
  // ===========================================================================
  "product__image": {
    borderColor: "#E9E9EC",
    borderRadius: 0,
  },
  "product__title": {
    color: "#1E2040",
    typescale: "h5",
    textTransform: "uppercase",
  },
  "product__description": {
    color: "#62637A",
    typescale: "body-sm",
    textTransform: "none",
  },
  "product__brand": {
    color: "#1E2040",
    typescale: "body-sm",
    textTransform: "uppercase",
  },
  "product__show-more": {
    color: "#0000FF",
  },

  // ===========================================================================
  // PRODUCT DETAILS
  // ===========================================================================
  "product-details": {
    borderColor: "#E9E9EC",
    borderRadius: 0,
    backgroundColor: "#FFFFFF",
  },
  "product-details__label": {
    color: "#1E2040",
    typescale: "body-sm",
    textTransform: "uppercase",
  },
  "product-details__value": {
    color: "#62637A",
    typescale: "body-sm",
    textTransform: "none",
  },

  // ===========================================================================
  // PRIMARY MENU
  // ===========================================================================
  "menu-primary-button": {
    borderColor: "#E9E9EC",
    backgroundColor: "#FFFFFF",
    color: "#1E2040",
    typescale: "body",
    textTransform: "uppercase",
  },
  "menu-primary-button__icon": {
    color: "#1E2040",
    size: 20,
  },

  // ===========================================================================
  // SECONDARY MENU
  // ===========================================================================
  "menu-secondary-button": {
    borderColor: "#E9E9EC",
    backgroundColor: "#FFFFFF",
    color: "#1E2040",
    typescale: "body",
    textTransform: "uppercase",
  },
  "menu-secondary-button__icon": {
    color: "#1E2040",
    size: 20,
  },

  // ===========================================================================
  // IMPACT
  // ===========================================================================
  "impact-card": {
    borderColor: "#E9E9EC",
    borderRadius: 0,
    backgroundColor: "#FFFFFF",
  },
  "impact-card__title": {
    color: "#1E2040",
    typescale: "h6",
    textTransform: "uppercase",
  },
  "impact-card__type": {
    color: "#62637A",
    typescale: "body-xs",
    textTransform: "uppercase",
  },
  "impact-card__value": {
    color: "#1E2040",
    typescale: "h1",
  },
  "impact-card__unit": {
    color: "#62637A",
    typescale: "body-xs",
    textTransform: "none",
  },
  "impact-card__eco-claim": {
    borderColor: "#E9E9EC",
    borderRadius: 0,
    backgroundColor: "#FFFFFF",
  },
  "impact-card__eco-claim-icon": {
    color: "#0000FF",
    size: 17.5,
  },
  "impact-card__eco-claim-text": {
    color: "#1E2040",
    typescale: "body-sm",
    textTransform: "none",
  },
  "impact-card__icon": {
    color: "#62637A",
    size: 28,
  },

  // ===========================================================================
  // MATERIALS
  // ===========================================================================
  "materials-card": {
    borderColor: "#E9E9EC",
    borderRadius: 0,
    backgroundColor: "#FFFFFF",
  },
  "materials-card__title": {
    color: "#1E2040",
    typescale: "h6",
    textTransform: "uppercase",
  },
  "materials-card__percentage": {
    color: "#1E2040",
    typescale: "body",
    textTransform: "none",
  },
  "materials-card__type": {
    color: "#1E2040",
    typescale: "body",
    textTransform: "uppercase",
  },
  "materials-card__certification": {
    color: "#03A458",
    backgroundColor: "#CDEDDE",
    borderRadius: 4,
    borderColor: "transparent",
    typescale: "body-xs",
    textTransform: "none",
  },
  "materials-card__certification-icon": {
    size: 12,
  },
  "materials-card__origin": {
    color: "#62637A",
    typescale: "body-xs",
    textTransform: "none",
  },
  "materials-card__certification-text": {
    color: "#0000FF",
    typescale: "body-xs",
    textTransform: "uppercase",
  },

  // ===========================================================================
  // JOURNEY
  // ===========================================================================
  "journey-card": {
    borderColor: "#E9E9EC",
    borderRadius: 0,
    backgroundColor: "#FFFFFF",
  },
  "journey-card__title": {
    color: "#1E2040",
    typescale: "h6",
    textTransform: "uppercase",
  },
  "journey-card__line": {
    backgroundColor: "#62637A",
  },
  "journey-card__type": {
    color: "#1E2040",
    typescale: "body",
    textTransform: "uppercase",
  },
  "journey-card__operator": {
    color: "#62637A",
    typescale: "body-xs",
    textTransform: "none",
  },

  // ===========================================================================
  // CAROUSEL
  // ===========================================================================
  "carousel__title": {
    color: "#1E2040",
    typescale: "h6",
    textTransform: "uppercase",
  },
  "carousel__nav-button": {
    borderColor: "#0000FF",
    backgroundColor: "transparent",
    color: "#0000FF",
    borderRadius: 0,
  },
  "carousel__nav-button-icon": {
    size: 16,
  },
  "carousel__product-image": {
    borderColor: "#E9E9EC",
    borderRadius: 0,
  },
  "carousel__product-details": {
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "flex-start",
  },
  "carousel__product-name": {
    color: "#0000FF",
    typescale: "body",
    textTransform: "uppercase",
  },
  "carousel__product-price": {
    color: "#1E2040",
    typescale: "body",
    textTransform: "none",
  },

  // ===========================================================================
  // BANNER
  // ===========================================================================
  banner: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E9E9EC",
    borderRadius: 0,
  },
  banner__container: {
    alignItems: "center",
    justifyContent: "center",
  },
  banner__headline: {
    color: "#FFFFFF",
    typescale: "h3",
    textTransform: "none",
  },
  banner__subline: {
    color: "#FFFFFF",
    typescale: "h5",
    textTransform: "none",
  },
  banner__button: {
    color: "#FFFFFF",
    backgroundColor: "#0000FF",
    borderColor: "#1E2040",
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
  images: {
    carouselImageZoom: 100,
    carouselImagePosition: "center",
  },
  materials: {
    showCertificationCheckIcon: true,
  },
};
