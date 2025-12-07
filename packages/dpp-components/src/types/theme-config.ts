/**
 * Theme Configuration Types
 * These represent the non-style configuration data for themes
 * (logos, menus, CTAs, social links, section visibility, etc.)
 */

export interface ThemeConfig {
  // Branding assets
  branding: {
    headerLogoUrl: string;
  };

  // Navigation menus
  menus: {
    primary: Array<{ label: string; url: string }>;
    secondary: Array<{ label: string; url: string }>;
  };

  // CTA Banner configuration
  cta: {
    bannerBackgroundImage: string;
    bannerHeadline: string;
    bannerSubline: string;
    bannerCTAText: string;
    bannerCTAUrl: string;
    // Visibility toggles for banner children
    showHeadline: boolean;
    showSubline: boolean;
    showButton: boolean;
  };

  // Social footer configuration (brand name comes from DppData.brandName)
  social: {
    showInstagram: boolean;
    showFacebook: boolean;
    showTwitter: boolean;
    showPinterest: boolean;
    showTiktok: boolean;
    showLinkedin: boolean;
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

  // Materials section configuration
  materials: {
    showCertificationCheckIcon: boolean;
  };

  // Product carousel configuration
  carousel: {
    productCount: number;
    showPrice: boolean;
    showTitle: boolean;
    roundPrice: boolean;
    // Product selection (used when fetching DPP to determine which products to show)
    filter?: Record<string, unknown>;
    includeIds?: string[];
    excludeIds?: string[];
  };
}
