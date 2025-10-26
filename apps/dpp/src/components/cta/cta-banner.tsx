import type { ThemeConfig } from '@/types/theme-config';

interface Props {
  theme: ThemeConfig;
}

export function CTABanner({ theme }: Props) {
  const { cta, branding } = theme;
  
  return (
    <div className="pt-2x pb-3x">
      <div
        className="relative w-full flex flex-col items-center justify-center py-3x px-lg rounded-rounding"
        style={{
          backgroundImage: `url(${cta.bannerBackgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="relative z-10 flex flex-col items-center gap-xl">
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
            <p 
              className="type-h5 text-center max-w-[600px] px-md"
              style={{ color: '#FFFFFF' }}
            >
              {cta.bannerSubline}
            </p>
          )}
          
          <a
            href={cta.bannerCTAUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="type-body-sm px-lg py-sm cursor-pointer text-center rounded-rounding"
            style={{
              backgroundColor: cta.bannerCTABackgroundColor,
              color: cta.bannerCTATextColor,
              minWidth: '150px',
            }}
          >
            {cta.bannerCTAText}
          </a>
        </div>
      </div>
    </div>
  );
}
