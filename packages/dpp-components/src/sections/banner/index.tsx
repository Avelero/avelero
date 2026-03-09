/**
 * Banner canvas section.
 *
 * Renders the full-width CTA banner inside the shared canvas wrapper.
 */

import Image from "next/image";
import { createSectionSelectionAttributes } from "../../lib/editor-selection";
import { resolveStyles } from "../../lib/resolve-styles";
import type { SectionProps } from "../registry";

/** Render the banner section with its background media and centered copy. */
export function BannerSection({
  section,
  tokens,
  zoneId,
  wrapperClassName,
}: SectionProps) {
  const s = resolveStyles(section.styles, tokens);
  const { headline, subline, ctaText, ctaUrl, backgroundImage } =
    section.content as {
      headline?: string;
      subline?: string;
      ctaText?: string;
      ctaUrl?: string;
      backgroundImage?: string;
    };
  const select = createSectionSelectionAttributes(section.id, zoneId);
  const containerSelection = select("banner.container", "overlay");
  const headlineSelection = select("banner.headline");
  const sublineSelection = select("banner.subline");
  const buttonSelection = select("banner.button");

  const isLocalDev =
    backgroundImage?.includes("127.0.0.1") ||
    backgroundImage?.includes("localhost:") ||
    backgroundImage?.includes("localhost/");

  return (
    <div className={wrapperClassName ?? "w-full"}>
      <div
        {...containerSelection}
        className="relative w-full flex flex-col items-center justify-center py-3x px-lg @3xl:px-3x overflow-hidden"
        style={s.container}
      >
        {backgroundImage && (
          <Image
            src={backgroundImage}
            alt=""
            fill
            className="object-cover"
            sizes="100vw"
            quality={90}
            priority={false}
            unoptimized={isLocalDev}
          />
        )}

        <div className="relative z-10 flex flex-col gap-xl w-full items-center">
          <div className="flex flex-col gap-lg">
            {headline && (
              <h2
                {...headlineSelection}
                className="max-w-[600px]"
                style={s.headline}
              >
                {headline}
              </h2>
            )}
            {subline && (
              <p
                {...sublineSelection}
                className="max-w-[600px]"
                style={s.subline}
              >
                {subline}
              </p>
            )}
          </div>

          {ctaUrl && ctaText && (
            <a
              {...buttonSelection}
              href={ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center self-center px-lg py-sm cursor-pointer text-center"
              style={s.button}
              aria-label={`${ctaText} (opens in new tab)`}
            >
              {ctaText}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
