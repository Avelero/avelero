/**
 * Google Fonts utility for dynamic font loading
 */

/**
 * Generates a Google Fonts URL for the given font families with optimal loading
 * @param fonts - Array of font family names (e.g., ['Inter', 'Roboto'])
 * @returns Google Fonts URL with display=swap for optimal loading
 */
export function generateGoogleFontsUrl(fonts: string[]): string {
  // Filter out Geist fonts (they're loaded locally)
  const googleFonts = fonts.filter(
    (font) => !font.toLowerCase().includes('geist')
  );

  if (googleFonts.length === 0) {
    return '';
  }

  // Format font names for Google Fonts API (CSS2)
  // Each font as a separate family parameter with variable font range
  const formattedFonts = googleFonts
    .map((font) => {
      const fontName = font.replace(/\s+/g, '+');
      // Use 300-900 weight range (most Google Fonts support this range)
      // Some fonts like Figtree only support 300-900, not 100-900
      return `family=${fontName}:ital,wght@0,300..900;1,300..900`;
    })
    .join('&');

  return `https://fonts.googleapis.com/css2?${formattedFonts}&display=swap`;
}

/**
 * Checks if a font is a Google Font (not a local/system font)
 * @param fontFamily - Font family name
 * @returns true if it's a Google Font that needs to be loaded
 */
export function isGoogleFont(fontFamily: string): boolean {
  const localFonts = ['geist', 'geist sans', 'geist mono', 'inter', 'system-ui', 'sans-serif', 'monospace', 'serif'];
  return !localFonts.some((local) => fontFamily.toLowerCase().includes(local.toLowerCase()));
}

/**
 * Extracts unique Google Fonts from a theme configuration's typography
 * @param typography - Typography configuration object with typescale definitions
 * @returns Array of unique Google Font names to load
 */
export function extractGoogleFontsFromTypography(typography?: Record<string, any>): string[] {
  const fonts = new Set<string>();

  if (!typography) {
    return [];
  }

  // Extract fonts from all typescale entries
  const typescales = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body', 'body-sm', 'body-xs'];
  
  for (const scale of typescales) {
    const scaleConfig = typography[scale];
    if (scaleConfig?.fontFamily && isGoogleFont(scaleConfig.fontFamily)) {
      fonts.add(scaleConfig.fontFamily);
    }
  }

  return Array.from(fonts);
}

