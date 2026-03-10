/**
 * Image cards canvas section.
 *
 * Renders a three-card marketing row that scrolls horizontally on small
 * screens and settles into a three-column grid on larger canvas layouts.
 */

import Image from "next/image";
import { ImagePlaceholder } from "../../components/image-placeholder";
import { createSectionSelectionAttributes } from "../../lib/editor-selection";
import {
  INTERACTIVE_HOVER_CLASS_NAME,
  createInteractiveHoverStyle,
} from "../../lib/interactive-hover";
import { resolveStyles } from "../../lib/resolve-styles";
import type { SectionProps } from "../registry";

type ImageCardId = "cardOne" | "cardTwo" | "cardThree";

interface ImageCardItem {
  id: ImageCardId;
  image: string;
  imageAlt: string;
  heading: string;
  body: string;
  url: string;
}

interface ImageCardsContent {
  title: string;
  cards: ImageCardItem[];
}

const IMAGE_CARD_FIELD_MAP = [
  {
    id: "cardOne",
    imageKey: "cardOneImage",
    imageAltKey: "cardOneImageAlt",
    headingKey: "cardOneHeading",
    bodyKey: "cardOneBody",
    urlKey: "cardOneUrl",
  },
  {
    id: "cardTwo",
    imageKey: "cardTwoImage",
    imageAltKey: "cardTwoImageAlt",
    headingKey: "cardTwoHeading",
    bodyKey: "cardTwoBody",
    urlKey: "cardTwoUrl",
  },
  {
    id: "cardThree",
    imageKey: "cardThreeImage",
    imageAltKey: "cardThreeImageAlt",
    headingKey: "cardThreeHeading",
    bodyKey: "cardThreeBody",
    urlKey: "cardThreeUrl",
  },
] as const;

/**
 * Read a string field from unknown section content with a safe fallback.
 */
function getStringContentValue(
  content: Record<string, unknown>,
  key: string,
): string {
  return typeof content[key] === "string" ? content[key] : "";
}

/**
 * Normalize the section content into a stable view model for rendering.
 */
function getImageCardsContent(
  content: Record<string, unknown>,
): ImageCardsContent {
  return {
    title: getStringContentValue(content, "title"),
    cards: IMAGE_CARD_FIELD_MAP.map((fieldMap) => ({
      id: fieldMap.id,
      image: getStringContentValue(content, fieldMap.imageKey),
      imageAlt: getStringContentValue(content, fieldMap.imageAltKey),
      heading: getStringContentValue(content, fieldMap.headingKey),
      body: getStringContentValue(content, fieldMap.bodyKey),
      url: getStringContentValue(content, fieldMap.urlKey),
    })),
  };
}

/**
 * Check whether the provided image URL should bypass Next.js optimization.
 */
function isLocalDevImage(value: string): boolean {
  return (
    value.includes("127.0.0.1") ||
    value.includes("localhost:") ||
    value.includes("localhost/")
  );
}

/**
 * Render the horizontally scrollable three-card canvas section.
 */
export function ImageCardsSection({
  section,
  tokens,
  zoneId,
  wrapperClassName,
}: SectionProps) {
  const s = resolveStyles(section.styles, tokens);
  const content = getImageCardsContent(section.content);
  const visibleCards = content.cards.filter(
    (card) =>
      card.image.trim() ||
      card.heading.trim() ||
      card.body.trim() ||
      card.url.trim(),
  );
  const select = createSectionSelectionAttributes(section.id, zoneId);
  const containerSelection = select("imageCards.container", "overlay");
  const titleSelection = select("imageCards.title");
  const buttonStyle = createInteractiveHoverStyle(s.cardButton, {
    color: true,
  });

  if (!content.title.trim() && visibleCards.length === 0) {
    return null;
  }

  return (
    <div className={wrapperClassName ?? "w-full"}>
      <div {...containerSelection} className="w-full" style={s.container}>
        <div className="flex flex-col gap-md">
          {content.title ? (
            <h3 {...titleSelection} className="px-md @md:px-0" style={s.title}>
              {content.title}
            </h3>
          ) : null}

          {visibleCards.length > 0 ? (
            <div className="scrollbar-none flex snap-x snap-mandatory gap-sm overflow-x-auto px-md scroll-pl-md @md:grid @md:grid-cols-3 @md:overflow-visible @md:px-0 @md:scroll-pl-0">
              {visibleCards.map((card) => {
                const imageSelection = select(
                  `imageCards.${card.id}.image`,
                  "overlay",
                );
                const headingSelection = select(
                  `imageCards.${card.id}.heading`,
                );
                const bodySelection = select(`imageCards.${card.id}.body`);
                const buttonSelection = select(`imageCards.${card.id}.button`);

                return (
                  <article
                    key={card.id}
                    className="flex w-[calc((100vw-2rem-0.75rem)/1.5)] min-w-[14rem] max-w-[19rem] shrink-0 snap-start flex-col gap-md @md:w-auto @md:min-w-0 @md:max-w-none"
                  >
                    <div
                      {...imageSelection}
                      className="relative w-full overflow-hidden"
                      style={s.cardImage}
                    >
                      {card.image ? (
                        <Image
                          src={card.image}
                          alt={card.imageAlt || card.heading || ""}
                          fill
                          className="object-cover"
                          sizes="(max-width: 767px) calc((100vw - 2rem - 0.75rem) / 1.5), (max-width: 1280px) calc((100vw - 2rem - 1.5rem) / 3), 360px"
                          quality={90}
                          priority={false}
                          unoptimized={isLocalDevImage(card.image)}
                        />
                      ) : (
                        <ImagePlaceholder />
                      )}
                    </div>

                    <div className="flex flex-col gap-xs">
                      {card.heading ? (
                        <h6 {...headingSelection} style={s.cardHeading}>
                          {card.heading}
                        </h6>
                      ) : null}

                      {card.body ? (
                        <p
                          {...bodySelection}
                          className="whitespace-pre-line"
                          style={s.cardBody}
                        >
                          {card.body}
                        </p>
                      ) : null}

                      {card.url ? (
                        <a
                          {...buttonSelection}
                          href={card.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex w-fit underline underline-offset-4 ${INTERACTIVE_HOVER_CLASS_NAME}`}
                          style={buttonStyle}
                          aria-label="Read More (opens in new tab)"
                        >
                          Read More
                        </a>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
