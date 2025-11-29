import type { DppData, ThemeConfig, ThemeStyles } from "@v1/dpp-components";
import { DesignEditorProvider } from "@/contexts/design-editor-provider";
import { DesignLeftPanel } from "@/components/design/design-left-panel";
import { DesignPreview } from "@/components/design/design-preview";
import "@v1/dpp-components/globals.css";

// Demo data for the design editor preview

const demoThemeConfig: ThemeConfig = {
  branding: {
    headerLogoUrl:
      "https://res.cloudinary.com/dcdam15xy/image/upload/f_webp/v1746526939/aveleroApparelLogoBlack_iuhow7.png",
    bannerLogoUrl:
      "https://res.cloudinary.com/dcdam15xy/image/upload/f_webp/v1746527118/aveleroApparelLogoWhite_b5drvc.png",
    bannerLogoHeight: 40,
  },
  menus: {
    primary: [
      { label: "Size Guide", url: "#size-guide" },
      { label: "Care Instructions", url: "#care-instructions" },
    ],
    secondary: [
      { label: "Sustainability Report", url: "#sustainability" },
      { label: "Certifications", url: "#certifications" },
      { label: "Returns & Warranty", url: "#returns" },
    ],
  },
  cta: {
    bannerBackgroundImage:
      "https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745934275/cta-banner-background_o3vjjw.jpg",
    bannerCTAText: "DISCOVER MORE",
    bannerCTAUrl: "https://example.com",
    bannerShowSubline: false,
    bannerSubline: "",
  },
  social: {
    legalName: "Acme Studios",
    showInstagram: true,
    showFacebook: true,
    showTwitter: true,
    showPinterest: false,
    showTiktok: false,
    showLinkedin: false,
    useIcons: false,
    instagramUrl: "https://instagram.com/acmestudios",
    facebookUrl: "https://facebook.com/acmestudios",
    twitterUrl: "https://twitter.com/acmestudios",
    pinterestUrl: "#",
    tiktokUrl: "#",
    linkedinUrl: "",
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
    productImagePosition: "top",
    carouselImageZoom: 100,
    carouselImagePosition: "top",
  },
  materials: {
    showCertificationCheckIcon: true,
  },
};

const demoThemeStyles: ThemeStyles = {};

const demoDppData: DppData = {
  title: "Classic Wool Jacket",
  brandName: "Avelero Apparel",
  productImage:
    "https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937619/ChatGPT_Image_29_apr_2025_16_40_03_trhpro.webp",
  description:
    "Jacket crafted with a blend of virgin wool and recycled polyester. Detailed with an Avelero Apparel logo embroidery at the back. Cut to a loose and comfortable fit, perfect for any occasion.",
  size: "M",
  color: "Black",
  category: "Outerwear",
  articleNumber: "ACM-WJ-001",
  manufacturer: "Sustainable Textiles Co.",
  countryOfOrigin: "Italy",
  materials: [
    {
      percentage: 55,
      type: "Virgin Wool",
      origin: "Beijing, China",
      certification: "Responsible Wool Standard",
      certificationUrl: "#",
    },
    {
      percentage: 45,
      type: "Recycled Polyester",
      origin: "Bangkok, Thailand",
      certification: "Global Recycled Standard",
      certificationUrl: "#",
    },
  ],
  journey: [
    {
      name: "Raw Material",
      companies: [
        { name: "Sinopec Group", location: "Beijing, China" },
        { name: "Indorama Ventures", location: "Bangkok, Thailand" },
      ],
    },
    {
      name: "Weaving",
      companies: [{ name: "Hengli Group", location: "Suzhou, China" }],
    },
    {
      name: "Assembly",
      companies: [
        {
          name: "Hebei Loto Garment Co., Ltd",
          location: "Hebei Province, China",
        },
      ],
    },
    {
      name: "Warehouse",
      companies: [
        {
          name: "Avelero Apparel International B.V.",
          location: "Amsterdam, The Netherlands",
        },
      ],
    },
  ],
  impactMetrics: [],
  impactClaims: [],
  similarProducts: [],
};

export default function DesignPage() {
  return (
    <DesignEditorProvider
      initialThemeConfig={demoThemeConfig}
      initialThemeStyles={demoThemeStyles}
      previewData={demoDppData}
    >
      <div className="flex h-full w-full">
        <DesignLeftPanel />
        <div className="flex h-full min-h-full flex-1 flex-col">
          <DesignPreview />
        </div>
      </div>
    </DesignEditorProvider>
  );
}
