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
  const rootSelection = select("hero");

  const brand = productAttributes.brand;
  const title = productIdentifiers.productName;

  if (!title && !brand) return null;

  return (
    <div
      {...rootSelection}
      className={["flex flex-col w-full", wrapperClassName]
        .filter(Boolean)
        .join(" ")}
    >
      {title ? <h1 style={s.title}>{title}</h1> : null}
      {brand ? <div style={s.brand}>{brand}</div> : null}
    </div>
  );
}
