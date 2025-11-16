/**
 * Theme Configuration Types
 * These represent the non-style configuration data for themes
 * (logos, menus, CTAs, social links, section visibility, etc.)
 */

export interface ThemeConfig {
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
  
  // CTA Banner configuration
  cta: {
    bannerBackgroundImage: string;
    bannerCTAText: string;
    bannerCTAUrl: string;
    bannerShowSubline: boolean;
    bannerSubline: string;
  };
  
  // Social footer configuration
  social: {
    legalName: string;
    showInstagram: boolean;
    showFacebook: boolean;
    showTwitter: boolean;
    showPinterest: boolean;
    showTiktok: boolean;
    showLinkedin: boolean;
    useIcons: boolean;
    instagramUrl: string;
    facebookUrl: string;
    twitterUrl: string;
    pinterestUrl: string;
    tiktokUrl: string;
    linkedinUrl: string;
  };
  
  // Section visibility toggles
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
  
  // Materials section configuration
  materials: {
    showCertificationCheckIcon: boolean;
  };
}