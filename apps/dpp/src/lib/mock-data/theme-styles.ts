import type { ThemeStyles } from "@/types/theme-styles";

/**
 * Mock theme styles for development
 * Contains only style overrides (colors, typography, component classes)
 * Each brand demonstrates different levels of customization
 */
export const mockThemeStyles: Record<string, ThemeStyles> = {
  mrmarvis: {
    // Typography-focused customization with Figtree and Noto Serif Display
    colors: {
      primary: "#071933",
      foreground: "rgba(7, 25, 51, 0.7)",
      background: "#FFFFFF",
      border: "#E5E8EB",
      highlight: "#3371A5",
    },
    typography: {
      h1: {
        fontSize: "2rem",
        fontFamily: "Figtree",
        fontWeight: 700,
        lineHeight: 1.3,
        letterSpacing: "0rem",
      },
      h2: {
        fontFamily: "Figtree",
        fontWeight: 700,
      },
      h3: {
        fontFamily: "Figtree",
        fontWeight: 640,
      },
      h4: {
        fontFamily: "Figtree",
        fontWeight: 640,
      },
      h5: {
        fontSize: "2rem",
        fontFamily: "Noto Serif Display",
        fontWeight: 400,
      },
      h6: {
        fontSize: "1.25rem",
        fontFamily: "Figtree",
        fontWeight: 580,
        lineHeight: 1.3,
        letterSpacing: "0.0008rem",
      },
      body: {
        fontSize: "1rem",
        fontFamily: "Figtree",
        fontWeight: 430,
      },
      "body-sm": {
        fontSize: "0.875rem",
        fontFamily: "Figtree",
        fontWeight: 430,
        lineHeight: 1.5,
        letterSpacing: "0.002rem",
      },
      "body-xs": {
        fontSize: "0.75rem",
        fontFamily: "Figtree",
        fontWeight: 430,
      },
    },
    // Component-specific overrides
    product__title: {
      lineHeight: 1.3,
      textTransform: "capitalize",
    },
    "impact-card": {
      borderRadius: "0.75rem",
    },
    "materials-card": {
      borderRadius: "0.75rem",
    },
    "journey-card": {
      borderRadius: "0.75rem",
    },
    // Banner CTA styling
    banner__button: {
      backgroundColor: "#FFFFFF",
      color: "#071933",
    },
    banner__subline: {
      color: "#071933",
    },
  },
  fillingpieces: {
    // Custom CDN fonts configuration
    customFonts: [
      {
        fontFamily: "ABC Favorit",
        src: "https://www.fillingpieces.com/cdn/shop/t/199/assets/ABCFavorit-Regular.woff2",
        fontWeight: 400,
        fontStyle: "normal",
        fontDisplay: "swap",
        format: "woff2",
      },
    ],
    // Heavy customization with ABC Favorit and custom styling
    colors: {
      primary: "#000000",
      foreground: "#000000",
      background: "#FFFFFF",
      border: "#000000",
      highlight: "#0000FF",
    },
    typography: {
      h1: {
        fontSize: "2.1875rem",
        fontFamily: "ABC Favorit",
        fontWeight: 500,
        lineHeight: 0.9,
        letterSpacing: "-0.0875rem",
      },
      h2: {
        fontFamily: "ABC Favorit",
        fontWeight: 700,
      },
      h3: {
        fontFamily: "ABC Favorit",
        fontWeight: 640,
      },
      h4: {
        fontFamily: "ABC Favorit",
        fontWeight: 640,
      },
      h5: {
        fontSize: "2rem",
        fontFamily: "ABC Favorit",
        fontWeight: 400,
      },
      h6: {
        fontSize: "1.25rem",
        fontFamily: "ABC Favorit",
        fontWeight: 580,
        lineHeight: 1.3,
        letterSpacing: "0.0008rem",
      },
      body: {
        fontSize: "0.875rem",
        fontFamily: "ABC Favorit",
        fontWeight: 500,
        lineHeight: 1.2,
        letterSpacing: "-0.02rem",
      },
      "body-sm": {
        fontSize: "0.875rem",
        fontFamily: "ABC Favorit",
        fontWeight: 400,
        lineHeight: 1.2,
        letterSpacing: "-0.04rem",
      },
      "body-xs": {
        fontSize: "0.75rem",
        fontFamily: "ABC Favorit",
        fontWeight: 430,
      },
    },
    // Component-specific overrides with minimal border radius
    product__image: {
      borderColor: "#FFFFFF",
    },
    product__title: {
      lineHeight: 0.9,
      letterSpacing: "-0.04em",
      textTransform: "capitalize", // Custom text transform
    },
    product__description: {
      color: "#000000",
      fontFamily: "Arial",
    },
    "product-details__row-value": {
      color: "#000000",
      textTransform: "uppercase",
    },
    "product-details__row-link": {
      color: "#000000",
      textDecoration: "underline",
    },
    "impact-card": {
      borderColor: "#000000",
    },
    "impact-card__type": {
      color: "#000000",
    },
    "impact-card__value": {
      color: "#000000",
    },
    "impact-card__unit": {
      color: "#000000",
    },
    "impact-card__eco-claim": {
      color: "#000000",
    },
    "impact-card__icon-leaf": {
      color: "#000000",
    },
    "impact-card__icon-drop": {
      color: "#000000",
    },
    "materials-card": {
      borderColor: "#000000",
    },
    "materials-card__percentage": {
      lineHeight: 1.43,
    },
    "materials-card__type": {
      lineHeight: 1.43,
    },
    "materials-card__origin": {
      color: "#000000",
    },
    "materials-card__certification-text": {
      color: "#000000",
      textTransform: "uppercase",
      textDecoration: "underline",
    },
    "materials-card__certification": {
      border: "1px solid",
      borderColor: "#000000",
      borderRadius: "0.5rem",
      backgroundColor: "#FFFFFF",
      color: "#000000",
      fontSize: "0.625rem",
    },
    "journey-card": {
      borderColor: "#000000",
    },
    "journey-card__type": {
      lineHeight: 1.43,
    },
    "journey-card__line": {
      color: "#000000",
    },
    "journey-card__operator": {
      color: "#000000",
    },
    "product-details": {
      borderColor: "#000000",
    },
    "menu-button": {
      borderColor: "#000000",
    },
    "carousel__product-image": {
      borderColor: "#FFFFFF",
    },
    "carousel__product-name": {
      color: "#000000",
      fontSize: "0.75rem",
      fontFamily: "ABC Favorit",
      fontWeight: 400,
      lineHeight: 1,
      letterSpacing: "0rem",
      textAlign: "center",
    },
    "carousel__product-price": {
      color: "#000000",
      fontSize: "0.75rem",
      fontFamily: "ABC Favorit",
      fontWeight: 400,
      lineHeight: 1,
      letterSpacing: "0rem",
      textAlign: "center",
    },
    carousel__title: {
      fontSize: "3.125rem",
      lineHeight: 0.9,
      letterSpacing: "0rem",
      textTransform: "capitalize",
    },
    "carousel__nav-button": {
      borderColor: "#FFFFFF",
      backgroundColor: "#FFFFFF",
      color: "#000000",
      borderRadius: "0.5rem",
    },
    // Banner CTA styling
    banner__button: {
      fontFamily: "ABC Favorit",
      fontSize: "0.75rem",
      fontWeight: 400,
      lineHeight: 1.2,
      letterSpacing: "-0.04rem",
      backgroundColor: "#FFFFFF",
      color: "#000000",
      borderRadius: "0.5rem",
      minWidth: "130px",
    },
    banner__subline: {
      fontFamily: "ABC Favorit",
      fontSize: "0.75rem",
      fontWeight: 400,
      lineHeight: 1.2,
      letterSpacing: "0rem",
      textTransform: "uppercase",
    },
    "footer__legal-name": {
      color: "#000000",
      fontFamily: "ABC Favorit",
      fontSize: "0.75rem",
      fontWeight: 400,
      lineHeight: 1.2,
      letterSpacing: "0rem",
      textTransform: "uppercase",
    },
    "footer__social-icons": {
      color: "#000000",
    },
  },
};
