/**
 * Minimal Google Fonts URL generation utilities for ThemeStyles typography.
 * This intentionally avoids any browser or React dependencies so it can be used in server actions.
 */

const LOCAL_FONTS = [
  "geist",
  "geist sans",
  "geist mono",
  "inter",
  "system-ui",
  "sans-serif",
  "monospace",
  "serif",
  "arial",
  "helvetica",
  "times",
  "courier",
  "verdana",
  "georgia",
  "palatino",
  "garamond",
  "bookman",
  "comic sans ms",
  "trebuchet ms",
  "impact",
];

/**
 * Checks if a font is a Google Font (not a local/system font).
 */
export function isGoogleFont(fontFamily: string): boolean {
  const primaryFamily =
    fontFamily
      .split(",")[0]
      ?.replace(/['"]/g, "")
      ?.trim()
      ?.toLowerCase() || "";

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
        scaleConfig.fontFamily
          .split(",")[0]
          ?.replace(/['"]/g, "")
          ?.trim() || "";

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

/**
 * Generates a conservative Google Fonts CSS2 URL for a list of fonts.
 * Uses a basic weight request (400..700) to keep responses small.
 */
export function generateGoogleFontsUrl(fonts: string[]): string {
  if (!fonts.length) return "";

  const families = fonts.map(
    (font) => `family=${formatFontFamily(font)}:wght@400;700`,
  );

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
