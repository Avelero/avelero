import type { ThemeConfig } from '@/types/theme-config';

interface Props {
  theme: ThemeConfig;
}

export function CTABanner({ theme }: Props) {
  const { cta, branding } = theme;
  
  return (
    <div className="mt-2x mb-3x">
      <div
        className="banner relative w-full flex flex-col items-center justify-center py-3x px-lg"
        style={{
          backgroundImage: `url(${cta.bannerBackgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="banner__container relative z-10 flex flex-col gap-xl w-full">
          {branding.bannerLogoUrl && (
            <div className="logo-container">
              <img
                src={branding.bannerLogoUrl}
                alt="Brand Logo"
                className="object-contain"
                style={{ height: `${branding.bannerLogoHeight}px`, width: 'auto' }}
              />
            </div>
          )}
          
          {cta.bannerShowSubline && cta.bannerSubline && (
            <p className="banner__subline text-center max-w-[600px] px-md">
              {cta.bannerSubline}
            </p>
          )}
          
          <a
            href={cta.bannerCTAUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="banner__button px-lg py-sm cursor-pointer text-center">
            {cta.bannerCTAText}
          </a>
        </div>
      </div>
    </div>
  );
}
