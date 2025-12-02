/**
 * Theme Styles Types
 * Defines the structure for theme style overrides that can be applied to component classes
 * and root-level design tokens (colors, typography)
 */

export interface CustomFont {
  fontFamily: string; // e.g., 'ABC Favorit', 'Brand Font'
  src: string; // CDN URL: 'https://cdn.example.com/font.woff2'
  fontWeight?: number | string; // 400, 700, or '100 900' for variable fonts
  fontStyle?: string; // 'normal', 'italic'
  fontDisplay?: string; // 'swap' (default), 'block', 'fallback', 'optional'
  format?: string; // 'woff2' (default), 'woff', 'truetype', 'opentype'
  unicodeRange?: string; // Optional: 'U+0000-00FF' for subsetting
}

export interface TypographyScale {
  fontSize?: string | number;
  fontWeight?: number;
  fontFamily?: string;
  lineHeight?: number | string;
  letterSpacing?: string | number;
}

export interface DesignTokens {
  colors?: {
    primary?: string;
    foreground?: string;
    background?: string;
    card?: string;
    cardForeground?: string;
    popover?: string;
    popoverForeground?: string;
    primaryForeground?: string;
    secondary?: string;
    secondaryForeground?: string;
    accent?: string;
    accentForeground?: string;
    destructive?: string;
    destructiveForeground?: string;
    highlight?: string;
    highlightForeground?: string;
    success?: string;
    successForeground?: string;
    border?: string;
    input?: string;
    ring?: string;
    link?: string; // Global link color
  };
  typography?: {
    h1?: TypographyScale;
    h2?: TypographyScale;
    h3?: TypographyScale;
    h4?: TypographyScale;
    h5?: TypographyScale;
    h6?: TypographyScale;
    body?: TypographyScale;
    "body-sm"?: TypographyScale;
    "body-xs"?: TypographyScale;
  };
}

export interface ComponentStyleOverride {
  // Typography
  fontSize?: string | number;
  fontWeight?: number;
  fontFamily?: string;
  lineHeight?: number | string;
  letterSpacing?: string | number;
  textTransform?: string;
  textDecoration?: string;
  whiteSpace?: string;
  textAlign?: string;

  // Typescale selection (h1, h2, ..., body, body-sm, body-xs)
  // When set, overrides individual typography properties
  typescale?: string;

  // Colors
  color?: string;
  backgroundColor?: string;
  backgroundImage?: string;

  // Borders
  border?: string;
  borderColor?: string;
  borderWidth?: string | number;
  borderStyle?: string;
  borderRadius?: string | number;

  // Layout
  display?: string;
  position?: string;
  top?: string | number;
  right?: string | number;
  bottom?: string | number;
  left?: string | number;
  width?: string | number;
  height?: string | number;
  minWidth?: string | number;
  minHeight?: string | number;
  maxWidth?: string | number;
  maxHeight?: string | number;
  overflow?: string;
  zIndex?: number;

  // Spacing
  padding?: string | number;
  paddingTop?: string | number;
  paddingRight?: string | number;
  paddingBottom?: string | number;
  paddingLeft?: string | number;
  margin?: string | number;
  marginTop?: string | number;
  marginRight?: string | number;
  marginBottom?: string | number;
  marginLeft?: string | number;
  gap?: string | number;
  rowGap?: string | number;
  columnGap?: string | number;

  // Flexbox
  flexDirection?: string;
  alignItems?: string;
  justifyContent?: string;
  flex?: string;

  // Visual Effects
  opacity?: number;
  transform?: string;
  transition?: string;
  boxShadow?: string;
  outline?: string;

  // Icon sizing
  size?: string | number;
}

/**
 * Theme Styles Configuration
 * Contains style overrides for component classes and design system tokens
 */
export interface ThemeStyles extends DesignTokens {
  customFonts?: CustomFont[]; // Array of custom CDN fonts to load via @font-face
  
  // Header
  header?: ComponentStyleOverride;
  "header__text-logo"?: ComponentStyleOverride;
  
  // Footer
  footer?: ComponentStyleOverride;
  "footer__legal-name"?: ComponentStyleOverride;
  "footer__social-icons"?: ComponentStyleOverride;
  
  // Product
  product__image?: ComponentStyleOverride;
  product__title?: ComponentStyleOverride;
  product__description?: ComponentStyleOverride;
  product__brand?: ComponentStyleOverride;
  "product__show-more"?: ComponentStyleOverride;
  
  // Product Details (simplified - container border color inherited by rows)
  "product-details"?: ComponentStyleOverride;
  "product-details__label"?: ComponentStyleOverride;
  "product-details__value"?: ComponentStyleOverride;
  
  // Primary Menu Button
  "menu-primary-button"?: ComponentStyleOverride;
  "menu-primary-button__icon"?: ComponentStyleOverride;
  
  // Secondary Menu Button
  "menu-secondary-button"?: ComponentStyleOverride;
  "menu-secondary-button__icon"?: ComponentStyleOverride;
  
  // Impact
  "impact-card"?: ComponentStyleOverride;
  "impact-card__title"?: ComponentStyleOverride;
  "impact-card__type"?: ComponentStyleOverride;
  "impact-card__value"?: ComponentStyleOverride;
  "impact-card__unit"?: ComponentStyleOverride;
  "impact-card__icon"?: ComponentStyleOverride;
  "impact-card__eco-claim"?: ComponentStyleOverride;
  "impact-card__eco-claim-icon"?: ComponentStyleOverride;
  "impact-card__eco-claim-text"?: ComponentStyleOverride;
  
  // Materials
  "materials-card"?: ComponentStyleOverride;
  "materials-card__title"?: ComponentStyleOverride;
  "materials-card__percentage"?: ComponentStyleOverride;
  "materials-card__type"?: ComponentStyleOverride;
  "materials-card__certification"?: ComponentStyleOverride;
  "materials-card__certification-icon"?: ComponentStyleOverride;
  "materials-card__origin"?: ComponentStyleOverride;
  "materials-card__certification-text"?: ComponentStyleOverride;
  
  // Journey
  "journey-card"?: ComponentStyleOverride;
  "journey-card__title"?: ComponentStyleOverride;
  "journey-card__line"?: ComponentStyleOverride;
  "journey-card__type"?: ComponentStyleOverride;
  "journey-card__operator"?: ComponentStyleOverride;
  
  // Carousel
  carousel__title?: ComponentStyleOverride;
  "carousel__nav-button"?: ComponentStyleOverride;
  "carousel__nav-button-icon"?: ComponentStyleOverride;
  "carousel__product-image"?: ComponentStyleOverride;
  "carousel__product-details"?: ComponentStyleOverride;
  "carousel__product-name"?: ComponentStyleOverride;
  "carousel__product-price"?: ComponentStyleOverride;
  
  // Banner
  banner?: ComponentStyleOverride;
  banner__container?: ComponentStyleOverride;
  banner__subline?: ComponentStyleOverride;
  banner__button?: ComponentStyleOverride;
}
