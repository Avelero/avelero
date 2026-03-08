/**
 * Sidebar hero section.
 *
 * Renders the product title first and the brand below it.
 */

import { createSectionSelectionAttributes } from "../../lib/editor-selection";
import { resolveStyles } from "../../lib/resolve-styles";
import type { SectionProps } from "../registry";

export function HeroSection({
  section,
  tokens,
  data,
  zoneId,
  wrapperClassName,
}: SectionProps) {
  // Resolve styles and read the product identity fields shown in the hero block.
  const s = resolveStyles(section.styles, tokens);
  const { productAttributes, productIdentifiers } = data;
  const select = createSectionSelectionAttributes(section.id, zoneId);
  const titleSelection = select("hero.title");
  const brandSelection = select("hero.brand");

  const brand = productAttributes.brand;
  const title = productIdentifiers.productName;

  if (!title && !brand) return null;

  return (
    <div
      className={["flex flex-col w-full", wrapperClassName]
        .filter(Boolean)
        .join(" ")}
    >
      {title ? (
        <h1 {...titleSelection} style={s.title}>
          {title}
        </h1>
      ) : null}
      {brand ? (
        <div {...brandSelection} style={s.brand}>
          {brand}
        </div>
      ) : null}
    </div>
  );
}
