/**
 * Google Fonts utility for dynamic font loading using the fonts package
 * Consolidates all Google Fonts functionality in one place
 */

import { fonts, findFont, getFontFallback, type FontMetadata } from '@v1/selections';

// ============================================================================
// TYPES
// ============================================================================

export interface GoogleFontAxis {
  tag: string;
  start: number;
  end: number;
}

export interface GoogleFontMetadata {
  family: string;
  variants?: string[];
  category: 'serif' | 'sans-serif' | 'display' | 'handwriting' | 'monospace';
  axes?: GoogleFontAxis[];
  isVariable: boolean;
}

// ============================================================================
// FONT DETECTION
// ============================================================================

/**
 * Checks if a font is a Google Font (not a local/system font)
 * @param fontFamily - Font family name
 * @returns true if it's a Google Font that needs to be loaded
 */
export function isGoogleFont(fontFamily: string): boolean {
  const localFonts = [
    'geist',
    'geist sans',
    'geist mono',
    'inter',
    'system-ui',
    'sans-serif',
    'monospace',
    'serif',
    'arial',
    'helvetica',
    'times',
    'courier',
    'verdana',
    'georgia',
    'palatino',
    'garamond',
    'bookman',
    'comic sans ms',
    'trebuchet ms',
    'impact',
  ];
  return !localFonts.some((local) =>
    fontFamily.toLowerCase().includes(local.toLowerCase())
  );
}

// ============================================================================
// FONT EXTRACTION
// ============================================================================

/**
 * Extracts unique Google Fonts from a theme configuration's typography
 * @param typography - Typography configuration object with typescale definitions
 * @returns Array of unique Google Font names to load
 */
export function extractGoogleFontsFromTypography(
  typography?: Record<string, any>
): string[] {
  const fontSet = new Set<string>();

  if (!typography) {
    return [];
  }

  // Extract fonts from all typescale entries
  const typescales = [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'body',
    'body-sm',
    'body-xs',
  ];

  for (const scale of typescales) {
    const scaleConfig = typography[scale];
    if (scaleConfig?.fontFamily && isGoogleFont(scaleConfig.fontFamily)) {
      fontSet.add(scaleConfig.fontFamily);
    }
  }

  return Array.from(fontSet);
}

// ============================================================================
// FONT METADATA LOOKUP
// ============================================================================

/**
 * Gets font metadata from the fonts package
 * @param fontFamily - Font family name
 * @returns Font metadata or null if not found
 */
export function getFontMetadata(fontFamily: string): GoogleFontMetadata | null {
  const font = findFont(fontFamily);
  
  if (!font) {
    return null;
  }

  return {
    family: font.family,
    category: font.category,
    isVariable: font.isVariable,
    axes: font.axes,
    variants: font.variants,
  };
}

/**
 * Gets metadata for multiple fonts from the fonts package
 * @param fontFamilies - Array of font family names
 * @returns Map of font family names to their metadata
 */
export function getMultipleFontMetadata(
  fontFamilies: string[]
): Map<string, GoogleFontMetadata> {
  const metadataMap = new Map<string, GoogleFontMetadata>();
  
  for (const fontFamily of fontFamilies) {
    const metadata = getFontMetadata(fontFamily);
    if (metadata) {
      metadataMap.set(fontFamily, metadata);
    }
  }

  return metadataMap;
}

// ============================================================================
// FONT FALLBACK DETECTION
// ============================================================================

/**
 * Gets the appropriate fallback font category
 */
export function getFontFallbackCategory(
  metadata: GoogleFontMetadata | null,
  fontFamily: string
): string {
  if (metadata?.category) {
    return metadata.category;
  }

  // Use the fonts package fallback function
  return getFontFallback(fontFamily);
}

// ============================================================================
// GOOGLE FONTS URL GENERATION
// ============================================================================

/**
 * Generates the axis specification for a variable font based on its metadata
 * @param metadata - Font metadata from fonts package
 * @returns Formatted axis specification string (e.g., "ital,wght@0,300..900;1,300..900")
 */
function generateAxisSpec(metadata: GoogleFontMetadata): string {
  if (!metadata.axes || metadata.axes.length === 0) {
    // Non-variable font - check if it has any variants
    if (metadata.variants && metadata.variants.length > 0) {
      // Font has specific weight variants - request them
      return `wght@${metadata.variants.join(';')}`;
    }
    // Font has no variants (like Alfa Slab One) - return empty string
    // This will result in just the family name without any weight specification
    return '';
  }

  // Standard registered axes supported by Google Fonts CSS2 API
  // Custom axes (like HEXP, CASL, CRSV, etc.) are NOT supported in URL format
  const STANDARD_AXES = ['ital', 'wght', 'wdth', 'slnt', 'opsz'];

  // Filter to only standard axes that Google Fonts CSS2 API supports
  const standardAxes = metadata.axes
    .filter((axis) => STANDARD_AXES.includes(axis.tag))
    .sort((a, b) => a.tag.localeCompare(b.tag));

  // Log custom axes that are being filtered out
  const customAxes = metadata.axes.filter((axis) => !STANDARD_AXES.includes(axis.tag));
  if (customAxes.length > 0) {
    console.log(
      `[Google Fonts] "${metadata.family}" has custom axes (${customAxes.map((a) => a.tag).join(', ')}) - these will be available in the font but cannot be specified in the URL`
    );
  }

  if (standardAxes.length === 0) {
    // Font only has custom axes - fallback to requesting standard weights
    console.warn(
      `[Google Fonts] "${metadata.family}" only has custom axes, no standard axes. Using fallback weight specification.`
    );
    return 'wght@400;700';
  }

  // Variable font - build axis specification using only standard axes
  const axes = standardAxes;

  // Build axis tags list
  const axisTags: string[] = [];
  const axisRanges: string[][] = [];

  // Check if font has italic axis
  const hasItalic = axes.some((axis) => axis.tag === 'ital');

  if (hasItalic) {
    axisTags.push('ital');
  }

  // Add other axes
  for (const axis of axes) {
    if (axis.tag !== 'ital') {
      axisTags.push(axis.tag);
    }
  }

  // Generate tuples for all axis combinations
  if (hasItalic) {
    // Generate for both normal (0) and italic (1)
    const nonItalicAxes = axes.filter((a) => a.tag !== 'ital');

    // Normal style tuple (ital=0)
    const normalTuple = ['0'];
    for (const axis of nonItalicAxes) {
      normalTuple.push(`${axis.start}..${axis.end}`);
    }
    axisRanges.push(normalTuple);

    // Italic style tuple (ital=1)
    const italicTuple = ['1'];
    for (const axis of nonItalicAxes) {
      italicTuple.push(`${axis.start}..${axis.end}`);
    }
    axisRanges.push(italicTuple);
  } else {
    // No italic, just use the axis ranges
    const tuple: string[] = [];
    for (const axis of axes) {
      tuple.push(`${axis.start}..${axis.end}`);
    }
    axisRanges.push(tuple);
  }

  const axisTagsStr = axisTags.join(',');
  const axisRangesStr = axisRanges.map((t) => t.join(',')).join(';');

  return `${axisTagsStr}@${axisRangesStr}`;
}

/**
 * Generates a Google Fonts URL with proper axis specifications based on font metadata
 * @param fontsWithMetadata - Map of font family names to their metadata
 * @returns Google Fonts URL with display=swap for optimal loading
 */
export function generateGoogleFontsUrl(
  fontsWithMetadata: Map<string, GoogleFontMetadata>
): string {
  if (fontsWithMetadata.size === 0) {
    return '';
  }

  // Format each font with its proper axis specification
  const formattedFonts: string[] = [];

  for (const [fontFamily, metadata] of fontsWithMetadata.entries()) {
    const fontName = fontFamily.replace(/\s+/g, '+');
    const axisSpec = generateAxisSpec(metadata);
    
    if (axisSpec) {
      // Font has axes or variants - include them in the URL
      formattedFonts.push(`family=${fontName}:${axisSpec}`);
    } else {
      // Font has no axes or variants - just use the family name
      formattedFonts.push(`family=${fontName}`);
    }
  }

  const url = `https://fonts.googleapis.com/css2?${formattedFonts.join('&')}&display=swap`;

  return url;
}

/**
 * Generates a fallback Google Fonts URL without metadata (uses conservative defaults)
 * This is used when metadata is unavailable or as a backup
 * @param fonts - Array of font family names
 * @returns Google Fonts URL with conservative weight ranges
 */
export function generateFallbackGoogleFontsUrl(fonts: string[]): string {
  // Filter out local fonts
  const googleFonts = fonts.filter(isGoogleFont);

  if (googleFonts.length === 0) {
    return '';
  }

  // Use conservative approach - just request the basic font without weight specifications
  // This works for fonts like "Alfa Slab One" that don't have weight variations
  const formattedFonts = googleFonts
    .map((font) => {
      const fontName = font.replace(/\s+/g, '+');
      // Just request the basic font - Google Fonts will serve the default weight
      return `family=${fontName}`;
    })
    .join('&');

  return `https://fonts.googleapis.com/css2?${formattedFonts}&display=swap`;
}

/**
 * Generates a Google Fonts URL from typography configuration
 * This is the main function to use for generating font URLs
 * @param typography - Typography configuration object
 * @returns Google Fonts URL with display=swap for optimal loading
 */
export function generateGoogleFontsUrlFromTypography(
  typography?: Record<string, any>
): string {
  // Extract Google Fonts from typography
  const googleFonts = extractGoogleFontsFromTypography(typography);
  
  if (googleFonts.length === 0) {
    return '';
  }

  // Get metadata for all fonts
  const fontsWithMetadata = getMultipleFontMetadata(googleFonts);
  
  // Generate URL with proper axis specifications
  return generateGoogleFontsUrl(fontsWithMetadata);
}

/**
 * Generates a Google Fonts URL for a single font family
 * @param fontFamily - Font family name
 * @returns Google Fonts URL with display=swap for optimal loading
 */
export function generateGoogleFontsUrlForFont(fontFamily: string): string {
  if (!isGoogleFont(fontFamily)) {
    return '';
  }

  const metadata = getFontMetadata(fontFamily);
  if (!metadata) {
    // Fallback to basic font request
    const fontName = fontFamily.replace(/\s+/g, '+');
    return `https://fonts.googleapis.com/css2?family=${fontName}&display=swap`;
  }

  const fontsWithMetadata = new Map([[fontFamily, metadata]]);
  return generateGoogleFontsUrl(fontsWithMetadata);
}