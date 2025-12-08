import opentype from "opentype.js";

// ============================================================================
// Types
// ============================================================================

export interface ParsedFontMetadata {
  fontFamily: string;
  fontWeight: number | string; // 400 or "100 900" for variable fonts
  fontStyle: "normal" | "italic" | "oblique";
  isVariable: boolean;
  format: "woff2" | "woff" | "truetype" | "opentype";
  weightRange?: { min: number; max: number };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Maps OS/2 weight class values to CSS font-weight values.
 * @see https://docs.microsoft.com/en-us/typography/opentype/spec/os2#usweightclass
 */
const WEIGHT_CLASS_MAP: Record<number, number> = {
  100: 100, // Thin
  200: 200, // Extra Light
  300: 300, // Light
  400: 400, // Normal/Regular
  500: 500, // Medium
  600: 600, // Semi Bold
  700: 700, // Bold
  800: 800, // Extra Bold
  900: 900, // Black
};

/**
 * Format detection based on file extension.
 */
const FORMAT_MAP: Record<string, ParsedFontMetadata["format"]> = {
  woff2: "woff2",
  woff: "woff",
  ttf: "truetype",
  otf: "opentype",
};

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Parse a font file and extract metadata using opentype.js.
 *
 * Extracts:
 * - Font family name (from name table)
 * - Weight class (from OS/2 table)
 * - Style (italic/oblique flags from OS/2 or head table)
 * - Variable font detection (fvar table presence)
 * - Weight axis range for variable fonts
 */
export async function parseFontFile(file: File): Promise<ParsedFontMetadata> {
  const arrayBuffer = await file.arrayBuffer();
  const font = opentype.parse(arrayBuffer);

  // Extract format from filename
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const format = FORMAT_MAP[ext] ?? "truetype";

  // Extract font family name
  const fontFamily = extractFontFamily(font, file.name);

  // Check if it's a variable font (has fvar table)
  const isVariable = hasVariableWeightAxis(font);

  // Extract weight
  let fontWeight: number | string = 400;
  let weightRange: { min: number; max: number } | undefined;

  if (isVariable) {
    const range = getVariableWeightRange(font);
    if (range) {
      weightRange = range;
      fontWeight = `${range.min} ${range.max}`;
    }
  } else {
    fontWeight = extractWeightClass(font);
  }

  // Extract style (italic/oblique)
  const fontStyle = extractFontStyle(font);

  return {
    fontFamily,
    fontWeight,
    fontStyle,
    isVariable,
    format,
    weightRange,
  };
}

/**
 * Normalize a font family name for use as a filename or CSS identifier.
 *
 * Examples:
 * - "Inter-Bold" → "inter"
 * - "Playfair Display" → "playfair-display"
 * - "Open Sans Condensed" → "open-sans-condensed"
 */
export function normalizeFontFamily(name: string): string {
  return name
    .toLowerCase()
    .replace(/[-_\s]+/g, "-") // Replace separators with hyphens
    .replace(/[^a-z0-9-]/g, "") // Remove special characters
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .replace(/^-|-$/g, ""); // Trim leading/trailing hyphens
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract font family name from the font's name table.
 * Falls back to filename if name table is missing or empty.
 */
function extractFontFamily(font: opentype.Font, filename: string): string {
  // Try to get the font family from name table
  // Name ID 1 = Font Family name
  // Name ID 16 = Typographic Family name (preferred for variable fonts)
  const names = font.names;

  // Prefer typographic family name (ID 16) if available
  const typographicFamily =
    names.preferredFamily?.en || names.preferredFamily?.["en-US"];
  if (typographicFamily) {
    return cleanFontFamilyName(typographicFamily);
  }

  // Fall back to font family name (ID 1)
  const fontFamily = names.fontFamily?.en || names.fontFamily?.["en-US"];
  if (fontFamily) {
    return cleanFontFamilyName(fontFamily);
  }

  // Last resort: use filename
  return cleanFontFamilyName(filename.replace(/\.[^.]+$/, ""));
}

/**
 * Clean up font family name by removing weight/style suffixes.
 */
function cleanFontFamilyName(name: string): string {
  // Remove common weight/style suffixes
  const suffixes = [
    "thin",
    "hairline",
    "extralight",
    "extra-light",
    "ultralight",
    "ultra-light",
    "light",
    "regular",
    "normal",
    "medium",
    "semibold",
    "semi-bold",
    "demibold",
    "demi-bold",
    "bold",
    "extrabold",
    "extra-bold",
    "ultrabold",
    "ultra-bold",
    "black",
    "heavy",
    "italic",
    "oblique",
    "roman",
  ];

  let cleaned = name.trim();

  // Remove suffix patterns like "-Bold", " Italic", etc.
  for (const suffix of suffixes) {
    const pattern = new RegExp(`[-_\\s]?${suffix}$`, "i");
    cleaned = cleaned.replace(pattern, "");
  }

  return cleaned.trim() || name.trim();
}

/**
 * Extract weight class from OS/2 table.
 */
function extractWeightClass(font: opentype.Font): number {
  // Access OS/2 table for weight class
  const os2 = (font.tables as Record<string, unknown>).os2 as
    | { usWeightClass?: number }
    | undefined;

  if (os2?.usWeightClass) {
    // Map to nearest standard weight
    const weightClass = os2.usWeightClass;
    return WEIGHT_CLASS_MAP[Math.round(weightClass / 100) * 100] ?? 400;
  }

  return 400; // Default to normal weight
}

/**
 * Extract font style (italic/oblique) from OS/2 and head tables.
 */
function extractFontStyle(
  font: opentype.Font,
): "normal" | "italic" | "oblique" {
  const os2 = (font.tables as Record<string, unknown>).os2 as
    | { fsSelection?: number }
    | undefined;

  // Check fsSelection flags in OS/2 table
  // Bit 0 = ITALIC, Bit 9 = OBLIQUE
  if (os2?.fsSelection) {
    const fsSelection = os2.fsSelection;
    if (fsSelection & (1 << 9)) return "oblique";
    if (fsSelection & 1) return "italic";
  }

  // Also check head table macStyle
  const head = (font.tables as Record<string, unknown>).head as
    | { macStyle?: number }
    | undefined;

  if (head?.macStyle) {
    // Bit 1 = Italic
    if (head.macStyle & 2) return "italic";
  }

  return "normal";
}

/**
 * Check if font has a variable weight axis (fvar table with wght axis).
 */
function hasVariableWeightAxis(font: opentype.Font): boolean {
  const fvar = (font.tables as Record<string, unknown>).fvar as
    | { axes?: Array<{ tag: string }> }
    | undefined;

  if (!fvar?.axes) return false;

  return fvar.axes.some((axis) => axis.tag === "wght");
}

/**
 * Get the weight range for a variable font.
 */
function getVariableWeightRange(
  font: opentype.Font,
): { min: number; max: number } | undefined {
  const fvar = (font.tables as Record<string, unknown>).fvar as
    | { axes?: Array<{ tag: string; minValue: number; maxValue: number }> }
    | undefined;

  if (!fvar?.axes) return undefined;

  const weightAxis = fvar.axes.find((axis) => axis.tag === "wght");
  if (!weightAxis) return undefined;

  return {
    min: Math.round(weightAxis.minValue),
    max: Math.round(weightAxis.maxValue),
  };
}

