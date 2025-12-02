import type { ThemeConfig } from "@v1/dpp-components";

interface Props {
  themeConfig: ThemeConfig;
}

export function CTABanner({ themeConfig }: Props) {
  const { cta } = themeConfig;

  return (
    <div className="mt-2x mb-3x">
      <div
        className="banner relative w-full flex flex-col items-center justify-center py-3x px-lg"
        style={{
          backgroundImage: `url(${cta?.bannerBackgroundImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="banner__container relative z-10 flex flex-col gap-xl w-full">
          {cta?.bannerHeadline && (
            <h2 className="banner__headline text-center max-w-[600px] px-md">
              {cta.bannerHeadline}
            </h2>
          )}

          {cta?.bannerSubline && (
            <p className="banner__subline text-center max-w-[600px] px-md">
              {cta.bannerSubline}
            </p>
          )}

          {cta?.bannerCTAUrl && cta?.bannerCTAText && (
            <a
              href={cta.bannerCTAUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="banner__button px-lg py-sm cursor-pointer text-center"
              aria-label={`${cta.bannerCTAText} (opens in new tab)`}
            >
              {cta.bannerCTAText}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
