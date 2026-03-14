/**
 * Font parsing helpers for custom font uploads in the theme editor.
 */

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

type FontStyle = ParsedFontMetadata["fontStyle"];

// ============================================================================
// Constants
// ============================================================================

/**
 * Format detection based on file extension.
 */
const FORMAT_MAP: Record<string, ParsedFontMetadata["format"]> = {
  woff2: "woff2",
  woff: "woff",
  ttf: "truetype",
  otf: "opentype",
};

const WEIGHT_NAME_PATTERNS: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /\b(thin|hairline)\b/i, weight: 100 },
  { pattern: /\b(extra[\s-]?light|ultra[\s-]?light)\b/i, weight: 200 },
  { pattern: /\blight\b/i, weight: 300 },
  { pattern: /\bbook\b/i, weight: 350 },
  { pattern: /\b(normal|regular|roman)\b/i, weight: 400 },
  { pattern: /\bmedium\b/i, weight: 500 },
  { pattern: /\b(semi[\s-]?bold|demi[\s-]?bold)\b/i, weight: 600 },
  { pattern: /\b(extra[\s-]?bold|ultra[\s-]?bold)\b/i, weight: 800 },
  { pattern: /\bbold\b/i, weight: 700 },
  { pattern: /\b(black|heavy)\b/i, weight: 900 },
];

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Parse a font file and extract metadata using opentype.js.
 */
export async function parseFontFile(file: File): Promise<ParsedFontMetadata> {
  const arrayBuffer = await file.arrayBuffer();
  const font = opentype.parse(arrayBuffer);
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const format = FORMAT_MAP[ext] ?? "truetype";
  const fontFamily = extractFontFamily(font, file.name);
  const isVariable = hasVariableWeightAxis(font);

  let fontWeight: number | string = 400;
  let weightRange: { min: number; max: number } | undefined;

  if (isVariable) {
    const range = getVariableWeightRange(font);
    if (range) {
      weightRange = range;
      fontWeight = `${range.min} ${range.max}`;
    }
  } else {
    fontWeight = extractWeightClass(font, file.name);
  }

  const fontStyle = extractFontStyle(font, file.name);

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
 */
export function normalizeFontFamily(name: string): string {
  return name
    .toLowerCase()
    .replace(/[-_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract the first localized name value from an OpenType name record.
 */
function getLocalizedName(record?: Record<string, string>): string | undefined {
  if (!record) return undefined;
  return record["en-US"] ?? record.en ?? Object.values(record)[0];
}

/**
 * Collect the most useful name strings for weight/style fallback parsing.
 */
function getNameCandidates(font: opentype.Font, filename: string): string[] {
  const names = font.names;

  return [
    getLocalizedName(names.preferredSubfamily),
    getLocalizedName(names.fontSubfamily),
    getLocalizedName(names.fullName),
    getLocalizedName(names.postScriptName),
    filename.replace(/\.[^.]+$/, ""),
  ].filter((value): value is string => Boolean(value?.trim()));
}

/**
 * Normalize a text candidate for weight and style matching.
 */
function normalizeSearchText(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase()
    .trim();
}

/**
 * Extract a numeric weight hint from name table text or the filename.
 */
function extractWeightFromText(...candidates: string[]): number | undefined {
  for (const candidate of candidates) {
    const normalized = normalizeSearchText(candidate);
    if (!normalized) continue;

    const numericMatch = normalized.match(/(^|\s)(\d{2,4})(?=\s|$)/);
    const numericWeight = Number.parseInt(numericMatch?.[2] ?? "", 10);
    if (
      numericMatch?.[2] &&
      !Number.isNaN(numericWeight) &&
      numericWeight >= 1 &&
      numericWeight <= 1000
    ) {
      return numericWeight;
    }

    for (const { pattern, weight } of WEIGHT_NAME_PATTERNS) {
      if (pattern.test(normalized)) {
        return weight;
      }
    }
  }

  return undefined;
}

/**
 * Extract a style hint from name table text or the filename.
 */
function extractStyleFromText(...candidates: string[]): FontStyle {
  for (const candidate of candidates) {
    const normalized = normalizeSearchText(candidate);
    if (!normalized) continue;

    if (/\boblique\b/i.test(normalized)) return "oblique";
    if (/\bitalic\b/i.test(normalized)) return "italic";
  }

  return "normal";
}

/**
 * Extract the raw OS/2 weight class without snapping to preset buckets.
 */
function getOs2WeightClass(font: opentype.Font): number | undefined {
  const os2 = (font.tables as Record<string, unknown>).os2 as
    | { usWeightClass?: number }
    | undefined;

  const weightClass = os2?.usWeightClass;
  if (weightClass === undefined) return undefined;

  const roundedWeight = Math.round(weightClass);
  if (roundedWeight < 1 || roundedWeight > 1000) return undefined;
  return roundedWeight;
}

/**
 * Extract font family name from the font's name table.
 */
function extractFontFamily(font: opentype.Font, filename: string): string {
  const names = font.names;
  const typographicFamily = getLocalizedName(names.preferredFamily);
  if (typographicFamily) {
    return cleanFontFamilyName(typographicFamily);
  }

  const fontFamily = getLocalizedName(names.fontFamily);
  if (fontFamily) {
    return cleanFontFamilyName(fontFamily);
  }

  return cleanFontFamilyName(filename.replace(/\.[^.]+$/, ""));
}

/**
 * Clean up font family name by removing trailing weight/style suffixes.
 */
function cleanFontFamilyName(name: string): string {
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

  for (const suffix of suffixes) {
    const pattern = new RegExp(`[-_\\s]?${suffix}$`, "i");
    cleaned = cleaned.replace(pattern, "");
  }

  return cleaned.trim() || name.trim();
}

/**
 * Extract the best static weight for a font file.
 */
function extractWeightClass(font: opentype.Font, filename: string): number {
  const os2Weight = getOs2WeightClass(font);
  const namedWeight = extractWeightFromText(
    ...getNameCandidates(font, filename),
  );

  if (os2Weight === undefined) {
    return namedWeight ?? 400;
  }

  if (namedWeight === undefined) {
    return os2Weight;
  }

  if (os2Weight === 400 && namedWeight !== 400) {
    return namedWeight;
  }

  return os2Weight;
}

/**
 * Extract font style (italic/oblique) from metadata and fallback name hints.
 */
function extractFontStyle(font: opentype.Font, filename: string): FontStyle {
  const namedStyle = extractStyleFromText(...getNameCandidates(font, filename));
  if (namedStyle !== "normal") {
    return namedStyle;
  }

  const os2 = (font.tables as Record<string, unknown>).os2 as
    | { fsSelection?: number }
    | undefined;

  if (os2?.fsSelection) {
    const fsSelection = os2.fsSelection;
    if (fsSelection & (1 << 9)) return "oblique";
    if (fsSelection & 1) return "italic";
  }

  const head = (font.tables as Record<string, unknown>).head as
    | { macStyle?: number }
    | undefined;

  if (head?.macStyle && head.macStyle & 2) {
    return "italic";
  }

  return "normal";
}

/**
 * Check if font has a variable weight axis.
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
