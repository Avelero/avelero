import type { ThemeConfig } from '@v1/dpp-components';

/**
 * Demo theme configuration for Avelero Apparel
 * Uses default styling (no theme-styles override)
 */
export const demoThemeConfig: ThemeConfig = {
  branding: {
    headerLogoUrl: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_webp/v1746526939/aveleroApparelLogoBlack_iuhow7.png',
    bannerLogoUrl: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_webp/v1746527118/aveleroApparelLogoWhite_b5drvc.png',
    bannerLogoHeight: 40,
  },
  
  menus: {
    primary: [
      { label: 'Care Instructions', url: 'https://avelero.com' },
      { label: 'Recycling & Repair', url: 'https://avelero.com' },
      { label: 'Warranty', url: 'https://avelero.com' },
    ],
    secondary: [
      { label: 'Compliance', url: 'https://avelero.com' },
    ],
  },
  
  cta: {
    bannerBackgroundImage: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745934275/cta-banner-background_o3vjjw.jpg',
    bannerCTAText: 'DISCOVER MORE',
    bannerCTAUrl: 'https://avelero.com',
    bannerShowSubline: false,
    bannerSubline: '',
  },
  
  social: {
    legalName: 'Avelero Apparel',
    showInstagram: false,
    showFacebook: false,
    showTwitter: true,
    showPinterest: false,
    showTiktok: false,
    showLinkedin: true,
    useIcons: false,
    instagramUrl: '',
    facebookUrl: '',
    twitterUrl: 'https://x.com/avelerodpp',
    pinterestUrl: '',
    tiktokUrl: '',
    linkedinUrl: 'https://www.linkedin.com/company/avelero',
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
  
  images: {
    carouselImageZoom: 100,
    carouselImagePosition: 'top',
  },
  
  materials: {
    showCertificationCheckIcon: true,
  },
};
