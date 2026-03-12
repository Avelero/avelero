/**
 * Shared font-weight normalization helpers for DPP interactive text styles.
 */

const FONT_WEIGHT_KEYWORDS: Record<string, number> = {
  bolder: 700,
  bold: 700,
  lighter: 300,
  normal: 400,
};

/**
 * Normalize a CSS font-weight into a numeric value for font matching.
 */
export function getRequestedFontWeight(
  value: React.CSSProperties["fontWeight"],
  fallbackWeight = 500,
): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();
    const keywordWeight = FONT_WEIGHT_KEYWORDS[normalizedValue];

    if (keywordWeight !== undefined) {
      return keywordWeight;
    }

    const parsedValue = Number.parseInt(normalizedValue, 10);
    if (!Number.isNaN(parsedValue)) {
      return parsedValue;
    }
  }

  return fallbackWeight;
}
