/**
 * Theme Styles Types
 * Defines the structure for theme style overrides that can be applied to component classes
 * and root-level design tokens (colors, typography)
 */

export interface TypographyScale {
  fontSize?: string;
  fontWeight?: number;
  fontFamily?: string;
  lineHeight?: number | string;
  letterSpacing?: string;
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
  };
  typography?: {
    h1?: TypographyScale;
    h2?: TypographyScale;
    h3?: TypographyScale;
    h4?: TypographyScale;
    h5?: TypographyScale;
    h6?: TypographyScale;
    body?: TypographyScale;
    'body-sm'?: TypographyScale;
    'body-xs'?: TypographyScale;
  };
}

export interface ComponentStyleOverride {
  // Typography
  fontSize?: string;
  fontWeight?: number;
  fontFamily?: string;
  lineHeight?: number | string;
  letterSpacing?: string;
  textTransform?: string;
  
  // Colors
  color?: string;
  backgroundColor?: string;
  
  // Borders
  border?: string;
  borderColor?: string;
  borderWidth?: string;
  borderStyle?: string;
  borderRadius?: string;
  
  // Layout
  width?: string;
  height?: string;
  minWidth?: string;
  minHeight?: string;
  maxWidth?: string;
  maxHeight?: string;
  
  // Spacing
  padding?: string;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  margin?: string;
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  
  // Flexbox
  flexDirection?: string;
  alignItems?: string;
  justifyContent?: string;
  flex?: string;
  
  // Other
  opacity?: number;
  transform?: string;
  transition?: string;
}

/**
 * Theme Styles Configuration
 * Contains style overrides for component classes and design system tokens
 */
export interface ThemeStyles extends DesignTokens {
  // Component class overrides - key matches the component class name in globals.css
  'header'?: ComponentStyleOverride;
  'header__text-logo'?: ComponentStyleOverride;
  'footer'?: ComponentStyleOverride;
  'footer__legal-name'?: ComponentStyleOverride;
  'footer__social-icons'?: ComponentStyleOverride;
  'product__image'?: ComponentStyleOverride;
  'product__title'?: ComponentStyleOverride;
  'product__description'?: ComponentStyleOverride;
  'product__brand'?: ComponentStyleOverride;
  'product__show-more'?: ComponentStyleOverride;
  'product-details'?: ComponentStyleOverride;
  'product-details__row'?: ComponentStyleOverride;
  'product-details__row-label'?: ComponentStyleOverride;
  'product-details__row-value'?: ComponentStyleOverride;
  'menu-button'?: ComponentStyleOverride;
  'impact-card'?: ComponentStyleOverride;
  'impact-card__title'?: ComponentStyleOverride;
  'impact-card__type'?: ComponentStyleOverride;
  'impact-card__value'?: ComponentStyleOverride;
  'impact-card__unit'?: ComponentStyleOverride;
  'impact-card__eco-claim'?: ComponentStyleOverride;
  'impact-card__eco-claim-text'?: ComponentStyleOverride;
  'materials-card'?: ComponentStyleOverride;
  'materials-card__title'?: ComponentStyleOverride;
  'materials-card__percentage'?: ComponentStyleOverride;
  'materials-card__type'?: ComponentStyleOverride;
  'materials-card__certification'?: ComponentStyleOverride;
  'materials-card__origin'?: ComponentStyleOverride;
  'materials-card__certification-text'?: ComponentStyleOverride;
  'journey-card'?: ComponentStyleOverride;
  'journey-card__title'?: ComponentStyleOverride;
  'journey-card__line'?: ComponentStyleOverride;
  'journey-card__type'?: ComponentStyleOverride;
  'journey-card__operator'?: ComponentStyleOverride;
  'carousel__title'?: ComponentStyleOverride;
  'carousel__nav-button'?: ComponentStyleOverride;
  'carousel__product-image'?: ComponentStyleOverride;
  'carousel__product-details'?: ComponentStyleOverride;
  'carousel__product-name'?: ComponentStyleOverride;
  'carousel__product-price'?: ComponentStyleOverride;
  'banner'?: ComponentStyleOverride;
  'banner__container'?: ComponentStyleOverride;
  'banner__subline'?: ComponentStyleOverride;
  'banner__button'?: ComponentStyleOverride;
}
