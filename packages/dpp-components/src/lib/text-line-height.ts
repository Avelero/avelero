/**
 * Line-box helpers for text-aligned UI chrome.
 *
 * Converts resolved typography styles into CSS-safe line-height values without DOM measurement.
 */

export function getResolvedTextLineHeight(
  style: React.CSSProperties | undefined,
  fallbackPx: number,
) {
  // Resolve the effective text line box height from inline typography styles.
  const fontSize = style?.fontSize;
  const lineHeight = style?.lineHeight;

  if (typeof lineHeight === "string" && lineHeight !== "normal") {
    return lineHeight;
  }

  if (typeof lineHeight === "number") {
    if (typeof fontSize === "string") {
      return `calc(${fontSize} * ${lineHeight})`;
    }

    if (typeof fontSize === "number") {
      return fontSize * lineHeight;
    }
  }

  return `${fallbackPx}px`;
}
