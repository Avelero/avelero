import type { ThemeConfig } from "@v1/dpp-components";
import Image from "next/image";

interface Props {
  themeConfig: ThemeConfig;
}

export function CTABanner({ themeConfig }: Props) {
  const { cta } = themeConfig;

  // Visibility toggles - default to true if not set
  const showHeadline = cta?.showHeadline ?? true;
  const showSubline = cta?.showSubline ?? true;
  const showButton = cta?.showButton ?? true;

  return (
    <div className="mt-3x mb-xl @3xl:mb-2x">
      <div className="banner relative w-full flex flex-col items-center justify-center py-3x px-lg @3xl:px-3x overflow-hidden">
        {/* Background image using Next.js Image */}
        {cta?.bannerBackgroundImage && (
          <Image
            src={cta.bannerBackgroundImage}
            alt=""
            fill
            className="object-cover"
            sizes="100vw"
            priority={false}
          />
        )}

        <div className="banner__container relative z-10 flex flex-col gap-xl w-full">
          <div className="flex flex-col gap-lg">
            {showHeadline && cta?.bannerHeadline && (
              <h2 className="banner__headline text-center max-w-[600px]">
                {cta.bannerHeadline}
              </h2>
            )}

            {showSubline && cta?.bannerSubline && (
              <p className="banner__subline text-center max-w-[600px]">
                {cta.bannerSubline}
              </p>
            )}
          </div>

          {showButton && cta?.bannerCTAUrl && cta?.bannerCTAText && (
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
