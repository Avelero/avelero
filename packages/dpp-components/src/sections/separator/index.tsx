/**
 * Separator section.
 *
 * Renders a simple full-width divider with fixed vertical spacing.
 */

import { createSectionSelectionAttributes } from "../../lib/editor-selection";
import { resolveStyles } from "../../lib/resolve-styles";
import type { SectionProps } from "../registry";

/**
 * Render the separator within the current layout zone.
 */
export function SeparatorSection({
  section,
  tokens,
  zoneId,
  wrapperClassName,
}: SectionProps) {
  // Resolve the divider color and reuse the shared section shell spacing from the layout renderer.
  const s = resolveStyles(section.styles, tokens);
  const select = createSectionSelectionAttributes(section.id, zoneId);
  const rootSelection = select("separator", "overlay");
  const rootClassName = wrapperClassName ?? "w-full";
  const innerClassName =
    zoneId === "canvas" ? "w-full px-md @md:px-0" : "w-full";

  return (
    <div {...rootSelection} className={rootClassName}>
      <div className={innerClassName}>
        <div className="w-full" style={s.line} />
      </div>
    </div>
  );
}
