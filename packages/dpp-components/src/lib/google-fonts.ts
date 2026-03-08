/**
 * Minimal Google Fonts URL generation utilities for Passport typography tokens.
 * This intentionally avoids any browser or React dependencies so it can be used in server actions.
 */
import { findFont } from "@v1/selections/fonts";

const LOCAL_FONTS = [
  "system-ui",
  "sans-serif",
  "monospace",
  "serif",
  "arial",
  "helvetica",
  "times",
  "verdana",
];
const PRESET_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

/**
 * Checks if a font is a Google Font (not a local/system font).
 */
export function isGoogleFont(fontFamily: string): boolean {
  const primaryFamily =
    fontFamily.split(",")[0]?.replace(/['"]/g, "")?.trim()?.toLowerCase() || "";

  if (!primaryFamily) {
    return false;
  }

  return !LOCAL_FONTS.includes(primaryFamily);
}

/**
 * Extracts unique Google Fonts from a typography object.
 */
export function extractGoogleFontsFromTypography(
  typography?: Record<string, any>,
): string[] {
  const fontSet = new Set<string>();

  if (!typography) {
    return [];
  }

  const typescales = [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "body",
    "body-sm",
    "body-xs",
  ];

  for (const scale of typescales) {
    const scaleConfig = typography[scale];
    if (scaleConfig?.fontFamily) {
      const primaryFont =
        scaleConfig.fontFamily.split(",")[0]?.replace(/['"]/g, "")?.trim() ||
        "";

      if (primaryFont && isGoogleFont(primaryFont)) {
        fontSet.add(primaryFont);
      }
    }
  }

  return Array.from(fontSet);
}

function formatFontFamily(font: string): string {
  return font.replace(/\s+/g, "+");
}

function parseVariantWeight(variant: string): number | undefined {
  // Normalize static variant values such as "regular", "700", or "700italic".
  const normalized = variant.toLowerCase();
  if (normalized === "regular" || normalized === "italic") {
    return 400;
  }

  const match = normalized.match(/\d{3}/);
  if (!match?.[0]) return undefined;

  const weight = Number.parseInt(match[0], 10);
  return Number.isNaN(weight) ? undefined : weight;
}

function getFallbackAxisWeight(start: number, end: number): number {
  // Clamp regular weight into axis range so URL generation always has a valid weight.
  const clampedWeight = Math.min(Math.max(400, start), end);
  return Math.round(clampedWeight);
}

function getFontWeights(fontFamily: string): number[] {
  // Resolve the safest available weight set for each Google font family.
  const metadata = findFont(fontFamily);
  if (!metadata) {
    return PRESET_WEIGHTS;
  }

  if (metadata.isVariable) {
    const weightAxis = metadata.axes.find((axis) => axis.tag === "wght");
    if (!weightAxis) {
      return [400];
    }

    const variableWeights = PRESET_WEIGHTS.filter(
      (weight) => weight >= weightAxis.start && weight <= weightAxis.end,
    );
    if (variableWeights.length > 0) {
      return variableWeights;
    }
    return [getFallbackAxisWeight(weightAxis.start, weightAxis.end)];
  }

  const staticWeights = Array.from(
    new Set(
      (metadata.variants ?? [])
        .map(parseVariantWeight)
        .filter((weight): weight is number => weight !== undefined),
    ),
  ).sort((a, b) => a - b);

  return staticWeights.length > 0 ? staticWeights : [400];
}

/**
 * Generates a Google Fonts CSS2 URL for a list of fonts.
 * Always includes an explicit weight axis for consistent rendering behavior.
 */
export function generateGoogleFontsUrl(fonts: string[]): string {
  if (!fonts.length) return "";

  const families = fonts.map((font) => {
    const weights = getFontWeights(font);
    return `family=${formatFontFamily(font)}:wght@${weights.join(";")}`;
  });

  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}

/**
 * Generates a Google Fonts URL from typography configuration.
 */
export function generateGoogleFontsUrlFromTypography(
  typography?: Record<string, any>,
): string {
  const googleFonts = extractGoogleFontsFromTypography(typography);
  return generateGoogleFontsUrl(googleFonts);
}

/**
 * Generates a Google Fonts URL for a single font family.
 */
export function generateGoogleFontsUrlForFont(fontFamily: string): string {
  if (!isGoogleFont(fontFamily)) {
    return "";
  }

  return generateGoogleFontsUrl([fontFamily]);
}
