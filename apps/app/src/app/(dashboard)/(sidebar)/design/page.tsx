import { Suspense } from "react";
import { Skeleton } from "@v1/ui/skeleton";
import { DesignProvider } from "@/components/design/design-provider";
import { PreviewFrame } from "@/components/design/preview-frame";
import { DeleteBrand } from "@/components/settings/delete-brand";
import { SetCountry } from "@/components/settings/set-country";
import { SetEmail } from "@/components/settings/set-email";
import { SetLogo } from "@/components/settings/set-logo";
import { SetName } from "@/components/settings/set-name";
import { HeaderSection } from "@/components/design/header-section";
import { MenuBlock } from "@/components/design/menu-block";
import type { ThemeConfig } from "@v1/dpp/types/theme-config";

// Initial demo config - will be replaced with DB fetch
const demoConfig: ThemeConfig = {
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
    productImageZoom: 100,
    productImagePosition: 'top',
    carouselImageZoom: 100,
    carouselImagePosition: 'top',
  },
  materials: {
    showCertificationCheckIcon: true,
  },
};

export default async function ContentPage() {
  // TODO: Fetch from database
  const initialConfig = demoConfig;

  return (
    <DesignProvider initialConfig={initialConfig}>
      <div className="flex w-full h-full">
        {/* Left Panel - Form Controls */}
        <div className="flex w-2/3 flex-col p-12 overflow-y-auto scrollbar-hide items-center">
          <div className="flex flex-col gap-6 max-w-[500px] w-full">
            <p className="type-h4 text-primary">Edit content</p>
            <HeaderSection />
            <MenuBlock />
            <Suspense fallback={<Skeleton className="h-[102px] w-full" />}>
              <SetLogo />
            </Suspense>
            <Suspense fallback={<Skeleton className="h-[187px] w-full" />}>
              <SetName />
            </Suspense>
            <Suspense fallback={<Skeleton className="h-[207px] w-full" />}>
              <SetEmail />
            </Suspense>
            <Suspense fallback={<Skeleton className="h-[187px] w-full" />}>
              <SetCountry />
            </Suspense>
            <Suspense fallback={<Skeleton className="h-[102px] w-full" />}>
              <DeleteBrand />
            </Suspense>
          </div>
        </div>

        {/* Right Panel - Preview */}
        <div className="flex w-1/3 h-full p-6 border-l border-border">
          <PreviewFrame />
        </div>
      </div>
    </DesignProvider>
  );
}
