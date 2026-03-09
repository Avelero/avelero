/**
 * Text and image canvas section.
 *
 * Renders a full-width feature block with a configurable image side on desktop
 * and configurable content order on mobile.
 */

import Image from "next/image";
import { ImagePlaceholder } from "../../components/image-placeholder";
import { createSectionSelectionAttributes } from "../../lib/editor-selection";
import { resolveStyles } from "../../lib/resolve-styles";
import type { SectionProps } from "../registry";

type ImagePosition = "left" | "right";
type MobileLayout = "split" | "imageFirst" | "textFirst";

interface TextImageContent {
  headline?: string;
  body?: string;
  image?: string;
  imageAlt?: string;
  imagePosition?: ImagePosition;
  mobileLayout?: MobileLayout;
}

/**
 * Normalize the section content into a strongly typed view model.
 */
function getTextImageContent(
  content: Record<string, unknown>,
): Required<TextImageContent> {
  return {
    headline: typeof content.headline === "string" ? content.headline : "",
    body: typeof content.body === "string" ? content.body : "",
    image: typeof content.image === "string" ? content.image : "",
    imageAlt: typeof content.imageAlt === "string" ? content.imageAlt : "",
    imagePosition: content.imagePosition === "left" ? "left" : "right",
    mobileLayout:
      content.mobileLayout === "imageFirst" ||
      content.mobileLayout === "textFirst"
        ? content.mobileLayout
        : "split",
  };
}

/**
 * Map the selected mobile layout to item ordering utilities.
 */
function getMobileOrderClassNames(
  mobileLayout: MobileLayout,
): Record<"heading" | "image" | "body", string> {
  switch (mobileLayout) {
    case "imageFirst":
      return {
        heading: "order-2 @3xl:order-none",
        image: "order-1 @3xl:order-none",
        body: "order-3 @3xl:order-none",
      };

    case "textFirst":
      return {
        heading: "order-1 @3xl:order-none",
        image: "order-3 @3xl:order-none",
        body: "order-2 @3xl:order-none",
      };

    default:
      return {
        heading: "order-1 @3xl:order-none",
        image: "order-2 @3xl:order-none",
        body: "order-3 @3xl:order-none",
      };
  }
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
 * Render the configurable text and image marketing block for the canvas zone.
 */
export function TextImageSection({
  section,
  tokens,
  zoneId,
  wrapperClassName,
}: SectionProps) {
  const s = resolveStyles(section.styles, tokens);
  const content = getTextImageContent(section.content);
  const select = createSectionSelectionAttributes(section.id, zoneId);
  const containerSelection = select("textImage.container", "overlay");
  const headingSelection = select("textImage.heading");
  const imageSelection = select("textImage.image", "overlay");
  const bodySelection = select("textImage.body");
  const mobileOrderClassNames = getMobileOrderClassNames(content.mobileLayout);
  const imageOnLeft = content.imagePosition === "left";
  const hasContent = Boolean(
    content.headline.trim() || content.body.trim() || content.image.trim(),
  );

  if (!hasContent) {
    return null;
  }

  const textContent = (
    <div
      className={[
        "contents @3xl:flex @3xl:flex-col @3xl:justify-between @3xl:self-stretch",
        imageOnLeft ? "@3xl:pl-8" : "@3xl:pr-8",
      ].join(" ")}
    >
      {content.headline ? (
        <h2
          {...headingSelection}
          className={[
            "whitespace-pre-line",
            mobileOrderClassNames.heading,
          ].join(" ")}
          style={s.heading}
        >
          {content.headline}
        </h2>
      ) : null}

      {content.body ? (
        <p
          {...bodySelection}
          className={["whitespace-pre-line", mobileOrderClassNames.body].join(
            " ",
          )}
          style={s.body}
        >
          {content.body}
        </p>
      ) : null}
    </div>
  );

  const imageContent = (
    <div
      {...imageSelection}
      className={[
        "relative w-full overflow-hidden",
        mobileOrderClassNames.image,
      ].join(" ")}
      style={s.image}
    >
      {content.image ? (
        <Image
          src={content.image}
          alt={content.imageAlt || content.headline || ""}
          fill
          className="object-cover"
          sizes="(max-width: 767px) calc(100vw - 2rem), (max-width: 1280px) calc((100vw - 2rem) / 2), 550px"
          quality={90}
          priority={false}
          unoptimized={isLocalDevImage(content.image)}
        />
      ) : (
        <ImagePlaceholder />
      )}
    </div>
  );

  return (
    <div className={wrapperClassName ?? "w-full"}>
      <div
        {...containerSelection}
        className="w-full px-md @3xl:px-0"
        style={s.container}
      >
        <div className="grid grid-cols-1 gap-y-lg @3xl:grid-cols-2 @3xl:items-stretch @3xl:gap-y-0">
          {imageOnLeft ? imageContent : textContent}
          {imageOnLeft ? textContent : imageContent}
        </div>
      </div>
    </div>
  );
}
