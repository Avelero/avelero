/**
 * Theme Configuration Types
 * These represent the private styling/theme data that will be fetched from tRPC
 */

export interface ThemeConfig {
  // Colors
  colors: {
    primaryText: string;
    secondaryText: string;
    background: string;
    border: string;
    primaryGreen: string;
    secondaryGreen: string;
    highlight: string;
  };
  
  // Typography - Typescale system with optional overrides
  typography?: {
    h1?: {
      fontSize?: string;
      fontWeight?: number;
      fontFamily?: string;
      lineHeight?: number | string;
      letterSpacing?: string;
    };
    h2?: {
      fontSize?: string;
      fontWeight?: number;
      fontFamily?: string;
      lineHeight?: number | string;
      letterSpacing?: string;
    };
    h3?: {
      fontSize?: string;
      fontWeight?: number;
      fontFamily?: string;
      lineHeight?: number | string;
      letterSpacing?: string;
    };
    h4?: {
      fontSize?: string;
      fontWeight?: number;
      fontFamily?: string;
      lineHeight?: number | string;
      letterSpacing?: string;
    };
    h5?: {
      fontSize?: string;
      fontWeight?: number;
      fontFamily?: string;
      lineHeight?: number | string;
      letterSpacing?: string;
    };
    h6?: {
      fontSize?: string;
      fontWeight?: number;
      fontFamily?: string;
      lineHeight?: number | string;
      letterSpacing?: string;
    };
    body?: {
      fontSize?: string;
      fontWeight?: number;
      fontFamily?: string;
      lineHeight?: number | string;
      letterSpacing?: string;
    };
    'body-sm'?: {
      fontSize?: string;
      fontWeight?: number;
      fontFamily?: string;
      lineHeight?: number | string;
      letterSpacing?: string;
    };
    'body-xs'?: {
      fontSize?: string;
      fontWeight?: number;
      fontFamily?: string;
      lineHeight?: number | string;
      letterSpacing?: string;
    };
  };
  
  // Spacing
  spacing: {
    micro: string;
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2x': string;
    '3x': string;
  };
  
  // Borders
  borders: {
    radius: {
      sm: string;
      md: string;
      lg: string;
    };
  };
  
  // Customizable rounding (optional - brand-specific border radius)
  rounding?: string;
  
  // Container
  container: {
    maxWidth: string;
  };
  
  // Section visibility
  sections: {
    showProductDetails: boolean;
    showPrimaryMenu: boolean;
    showSecondaryMenu: boolean;
    showImpact: boolean;
    showMaterials: boolean;
    showJourney: boolean;
    showSimilarProducts: boolean;
    showCTABanner: boolean;
  };
  
  // Image controls
  images: {
    productImageZoom: number;
    productImagePosition: 'top' | 'center' | 'bottom';
    carouselImageZoom: number;
    carouselImagePosition: 'top' | 'center' | 'bottom';
  };
  
  // Branding assets
  branding: {
    headerLogoUrl: string;
    bannerLogoUrl: string;
    bannerLogoHeight: number;
  };
  
  // Navigation menus
  menus: {
    primary: Array<{ label: string; url: string }>;
    secondary: Array<{ label: string; url: string }>;
  };
  
  // CTA Banner
  cta: {
    bannerBackgroundImage: string;
    bannerCTAText: string;
    bannerCTAUrl: string;
    bannerCTABackgroundColor: string;
    bannerCTATextColor: string;
    bannerShowSubline: boolean;
    bannerSubline: string;
  };
  
  // Social footer
  social: {
    legalName: string;
    showInstagram: boolean;
    showFacebook: boolean;
    showTwitter: boolean;
    showPinterest: boolean;
    showTiktok: boolean;
    useIcons: boolean;
    instagramUrl: string;
    facebookUrl: string;
    twitterUrl: string;
    pinterestUrl: string;
    tiktokUrl: string;
  };
}


