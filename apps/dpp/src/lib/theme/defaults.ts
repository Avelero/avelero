import type { ThemeConfig } from '@/types/theme-config';

/**
 * Default theme configuration
 * Used as fallback when no custom theme is provided
 */
export const defaultTheme: ThemeConfig = {
  colors: {
    primaryText: '#1E2040',
    secondaryText: '#62637A',
    background: '#FFFFFF',
    border: '#E9E9EC',
    primaryGreen: '#03A458',
    secondaryGreen: '#CDEDDE',
    highlight: '#0000FF',
  },
  typography: {
    fontFamily: {
      primary: 'Geist',
      mono: 'Geist Mono',
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      h6: '1.125rem',
      h5: '1.25rem',
      h4: '1.4375rem',
      h3: '1.625rem',
      h2: '1.8125rem',
      h1: '2rem',
    },
    fontWeight: {
      light: 300,
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      80: 0.8,
      90: 0.9,
      100: 1,
      110: 1.1,
      125: 1.25,
      140: 1.4,
      150: 1.5,
      175: 1.75,
      200: 2,
    },
  },
  spacing: {
    micro: '0.25rem',
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2x': '3rem',
    '3x': '4.5rem',
  },
  borders: {
    radius: {
      sm: '0.25rem',
      md: '0.5rem',
      lg: '1rem',
    },
  },
  container: {
    maxWidth: '1100px',
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
    productImageZoom: 100,
    productImagePosition: 'center',
    carouselImageZoom: 100,
    carouselImagePosition: 'center',
  },
  branding: {
    headerLogoUrl: '',
    bannerLogoUrl: '',
    bannerLogoHeight: 40,
  },
  menus: {
    primary: [],
    secondary: [],
  },
  cta: {
    bannerBackgroundImage: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745934275/cta-banner-background_o3vjjw.jpg',
    bannerCTAText: 'DISCOVER MORE',
    bannerCTAUrl: '#discover-more',
    bannerCTABackgroundColor: '#0000FF',
    bannerCTATextColor: '#FFFFFF',
    bannerShowSubline: false,
    bannerSubline: '',
  },
  social: {
    legalName: 'Brand Name',
    showInstagram: true,
    showFacebook: true,
    showTwitter: true,
    showPinterest: false,
    showTiktok: false,
    useIcons: true,
    instagramUrl: '#instagram',
    facebookUrl: '#facebook',
    twitterUrl: '#twitter',
    pinterestUrl: '#pinterest',
    tiktokUrl: '#tiktok',
  },
};


