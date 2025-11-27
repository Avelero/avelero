import type { ThemeConfig } from '@v1/dpp-components';

/**
 * Mock theme configurations for development
 * Contains only non-style configuration data (logos, menus, CTAs, social links, etc.)
 */
export const mockThemeConfigs: Record<string, ThemeConfig> = {
  'acme': {
    branding: {
      headerLogoUrl: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_webp/v1746526939/aveleroApparelLogoBlack_iuhow7.png',
      bannerLogoUrl: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_webp/v1746527118/aveleroApparelLogoWhite_b5drvc.png',
      bannerLogoHeight: 40,
    },
    menus: {
      primary: [
        { label: 'Size Guide', url: '#size-guide' },
        { label: 'Care Instructions', url: '#care-instructions' },
      ],
      secondary: [
        { label: 'Sustainability Report', url: '#sustainability' },
        { label: 'Certifications', url: '#certifications' },
        { label: 'Returns & Warranty', url: '#returns' },
      ],
    },
    cta: {
      bannerBackgroundImage: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745934275/cta-banner-background_o3vjjw.jpg',
      bannerCTAText: 'DISCOVER MORE',
      bannerCTAUrl: 'https://example.com',
      bannerShowSubline: false,
      bannerSubline: '',
    },
    social: {
      legalName: 'Acme Studios',
      showInstagram: true,
      showFacebook: true,
      showTwitter: true,
      showPinterest: false,
      showTiktok: false,
      showLinkedin: false,
      useIcons: false,
      instagramUrl: 'https://instagram.com/acmestudios',
      facebookUrl: 'https://facebook.com/acmestudios',
      twitterUrl: 'https://twitter.com/acmestudios',
      pinterestUrl: '#',
      tiktokUrl: '#',
      linkedinUrl: '',
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
      productImagePosition: 'top',
      carouselImageZoom: 100,
      carouselImagePosition: 'top',
    },
    materials: {
      showCertificationCheckIcon: true,
    },
  },
  'mrmarvis': {
    branding: {
      headerLogoUrl: 'https://i.imgur.com/5h0kn61.png',
      bannerLogoUrl: '',
      bannerLogoHeight: 42,
    },
    menus: {
      primary: [
        { label: 'Care', url: 'https://www.mrmarvis.com/nl/care-guide?collection=c9d41806-cfee-40dc-86f1-55e9fce859af' },
        { label: 'Recycling', url: 'https://www.mrmarvis.com/nl/mr-marvis-x-sellpy' },
        { label: 'Exchange & Returns', url: 'https://www.mrmarvis.com/nl/exchanges-returns' },
      ],
      secondary: [
        { label: 'Our Purpose', url: 'https://www.mrmarvis.com/nl/our-purpose' },
        { label: 'Action Reports', url: 'https://www.mrmarvis.com/nl/action-report' },
        { label: 'Support', url: 'https://www.mrmarvis.com/nl/support' },
      ],
    },
    cta: {
      bannerBackgroundImage: 'https://cdn.mrmarvis.com/images/yb9xf4jc/production/0ea2184a9b494f8ab60d440f178de577589fa776-3900x1300.jpg',
      bannerCTAText: 'Shop nu',
      bannerCTAUrl: 'https://www.mrmarvis.com/nl/collections/easies',
      bannerShowSubline: true,
      bannerSubline: 'Ontdek The Easies: de ultieme sweatpants',
    },
    social: {
      legalName: 'MR MARVIS Netherlands B.V.',
      showInstagram: true,
      showFacebook: true,
      showTwitter: false,
      showPinterest: false,
      showTiktok: true,
      showLinkedin: false,
      useIcons: true,
      instagramUrl: 'https://www.instagram.com/mrmarvis',
      facebookUrl: 'https://www.facebook.com/MRMARVIS.official',
      twitterUrl: '',
      pinterestUrl: '',
      tiktokUrl: 'https://www.tiktok.com/@mrmarvis_',
      linkedinUrl: '',
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
    materials: {
      showCertificationCheckIcon: true,
    },
  },
  'fillingpieces': {
    branding: {
      headerLogoUrl: 'https://res.cloudinary.com/dcdam15xy/image/upload/fillingpieces-logo_cf9k3h.svg',
      bannerLogoUrl: 'https://res.cloudinary.com/dcdam15xy/image/upload/fillingpieces-logo-white_gysdgk.svg',
      bannerLogoHeight: 38,
    },
    menus: {
      primary: [
        { label: 'Care & Materials', url: 'https://www.fillingpieces.com/pages/materials-care' },
        { label: 'Support', url: 'https://www.fillingpieces.com/pages/faq-top-5-questions' },
        { label: 'Quality & Craftsmanship', url: 'https://www.fillingpieces.com/pages/quality-craft' },
      ],
      secondary: [
        { label: 'Responsibility', url: 'https://www.fillingpieces.com/pages/responsibility-1' },
        { label: 'Loyalty', url: 'https://www.fillingpieces.com/pages/loyalty' },
      ],
    },
    cta: {
      bannerBackgroundImage: 'https://www.fillingpieces.com/cdn/shop/files/Homepage_Banner_-_Desktop_-_V6_2.jpg?v=1758107353&width=1640',
      bannerCTAText: 'Shop Now',
      bannerCTAUrl: 'https://www.fillingpieces.com/nl/collections/men-apparel',
      bannerShowSubline: true,
      bannerSubline: 'Master unpredictable weather with versatile layers designed for both comfort and a refined silhouette.',
    },
    social: {
      legalName: 'Filling Pieces',
      showInstagram: true,
      showFacebook: false,
      showTwitter: true,
      showPinterest: true,
      showTiktok: true,
      showLinkedin: false,
      useIcons: true,
      instagramUrl: 'https://www.instagram.com/fillingpieces/',
      facebookUrl: 'https://www.facebook.com/fillingpieces/',
      twitterUrl: 'https://x.com/FillingPieces',
      pinterestUrl: 'https://nl.pinterest.com/fillingpieces/',
      tiktokUrl: 'https://www.tiktok.com/@fillingpieces',
      linkedinUrl: '',
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
      productImagePosition: 'top',
      carouselImageZoom: 100,
      carouselImagePosition: 'top',
    },
    materials: {
      showCertificationCheckIcon: false,
    },
  },
};
