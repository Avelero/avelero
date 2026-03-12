/**
 * Text canvas section.
 *
 * Renders a single text block inside the shared canvas wrapper with an inner
 * shell that only adds extra padding from the medium container breakpoint up.
 */

import { createSectionSelectionAttributes } from "../../lib/editor-selection";
import { resolveStyles } from "../../lib/resolve-styles";
import type { SectionProps } from "../registry";

/**
 * Normalize the configured text content into a renderable string.
 */
function getTextBody(content: Record<string, unknown>): string {
  return typeof content.body === "string" ? content.body : "";
}

/**
 * Render the canvas text block with responsive inner padding.
 */
export function TextSection({
  section,
  tokens,
  zoneId,
  wrapperClassName,
}: SectionProps) {
  // Resolve the section shell and text styles, then expose only the section root to the editor.
  const s = resolveStyles(section.styles, tokens);
  const body = getTextBody(section.content);
  const select = createSectionSelectionAttributes(section.id, zoneId);
  const rootSelection = select("text", "overlay");

  if (!body.trim()) {
    return null;
  }

  return (
    <div {...rootSelection} className={wrapperClassName ?? "w-full"}>
      <div className="w-full px-0 py-0 @md:px-4 @md:py-8" style={s.container}>
        <p className="whitespace-pre-line" style={s.body}>
          {body}
        </p>
      </div>
    </div>
  );
}
