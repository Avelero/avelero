/**
 * Shared inline action-link styling for underlined passport controls.
 *
 * Keeps link color, weight fallback, and underline placement consistent across
 * the interactive text buttons used throughout the passport experience.
 */

import type { CustomFont } from "../types/passport";
import { getRequestedFontWeight } from "./font-weight";
import { resolveClosestAvailableFontWeight } from "./google-fonts";
import { createInteractiveHoverStyle } from "./interactive-hover";
import { getResolvedTextLineHeight } from "./text-line-height";

interface UnderlinedActionOptions {
  customFonts?: CustomFont[];
  defaultColor?: string;
}

/**
 * Parse a CSS font size into pixels when possible so line-box math stays deterministic.
 */
function parseFontSizePx(
  value: React.CSSProperties["fontSize"],
): number | undefined {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalizedValue = value.trim();
  if (normalizedValue.endsWith("px")) {
    const parsedValue = Number.parseFloat(normalizedValue);
    return Number.isNaN(parsedValue) ? undefined : parsedValue;
  }

  if (normalizedValue.endsWith("rem")) {
    const parsedValue = Number.parseFloat(normalizedValue);
    return Number.isNaN(parsedValue) ? undefined : parsedValue * 16;
  }

  return undefined;
}

/**
 * Append the shared underline shadow without discarding any existing shadows.
 */
function appendUnderlineShadow(
  existingShadow: React.CSSProperties["boxShadow"],
): string {
  const underlineShadow = "inset 0 -1px 0 currentColor";

  if (typeof existingShadow === "string" && existingShadow.trim().length > 0) {
    return `${existingShadow}, ${underlineShadow}`;
  }

  return underlineShadow;
}

/**
 * Build the standardized underlined text-action style used by inline passport links.
 */
export function createUnderlinedActionStyle(
  style: React.CSSProperties | undefined,
  { customFonts = [], defaultColor }: UnderlinedActionOptions,
): React.CSSProperties {
  const nextStyle: React.CSSProperties = {
    ...(style ?? {}),
  };
  const fontSizePx = parseFontSizePx(nextStyle.fontSize);
  const fallbackLineHeight = fontSizePx !== undefined ? fontSizePx * 1.2 : 24;
  const resolvedLineHeight = getResolvedTextLineHeight(
    nextStyle,
    fallbackLineHeight,
  );
  const resolvedFontWeight = resolveClosestAvailableFontWeight(
    typeof nextStyle.fontFamily === "string" ? nextStyle.fontFamily : undefined,
    getRequestedFontWeight(nextStyle.fontWeight),
    customFonts,
  );

  nextStyle.color =
    typeof nextStyle.color === "string"
      ? nextStyle.color
      : defaultColor ?? nextStyle.color;
  nextStyle.fontWeight = resolvedFontWeight;
  nextStyle.lineHeight = resolvedLineHeight;
  nextStyle.minHeight = resolvedLineHeight;
  nextStyle.display = nextStyle.display ?? "inline-flex";
  nextStyle.alignItems = nextStyle.alignItems ?? "flex-end";
  nextStyle.textDecoration = "none";
  nextStyle.boxShadow = appendUnderlineShadow(nextStyle.boxShadow);

  return createInteractiveHoverStyle(nextStyle, { color: true });
}
