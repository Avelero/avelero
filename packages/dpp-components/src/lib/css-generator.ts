/**
 * CSS generator for the DPP theme system.
 *
 * Generates only design token CSS variables (colors, typography) and @font-face rules.
 * Component-level styling is handled via inline styles from resolveStyles().
 */

import { getFontFallback } from "@v1/selections/fonts";
import type { CustomFont, Passport } from "../types/passport";

/** Converts camelCase to kebab-case. */
function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}

/**
 * Generates design token CSS variables (colors + typography) for .dpp-root.
 * These override the defaults in globals.css.
 */
export function generateDesignTokenCSS(tokens: Passport["tokens"]): string {
  const vars: string[] = [];

  // Colors
  for (const [key, value] of Object.entries(tokens.colors)) {
    if (value) {
      vars.push(`--${camelToKebab(key)}: ${value}`);
    }
  }

  // Typography
  for (const [scale, config] of Object.entries(tokens.typography)) {
    if (!config) continue;
    if (config.fontSize !== undefined) {
      vars.push(`--type-${scale}-size: ${config.fontSize / 16}rem`);
    }
    if (config.fontWeight !== undefined) {
      vars.push(`--type-${scale}-weight: ${config.fontWeight}`);
    }
    if (config.fontFamily) {
      const fallback = getFontFallback(config.fontFamily);
      vars.push(`--type-${scale}-family: "${config.fontFamily}", ${fallback}`);
    }
    if (config.lineHeight !== undefined) {
      vars.push(`--type-${scale}-line-height: ${config.lineHeight}`);
    }
    if (config.letterSpacing !== undefined) {
      vars.push(`--type-${scale}-letter-spacing: ${config.letterSpacing}px`);
    }
  }

  if (vars.length === 0) return "";
  return `.dpp-root {\n  ${vars.join(";\n  ")};\n}`;
}

/**
 * Generates @font-face CSS rules from custom fonts.
 */
export function generateFontFaceCSS(customFonts?: CustomFont[]): string {
  if (!customFonts || customFonts.length === 0) return "";

  return customFonts
    .map((font) => {
      const sanitize = (value: string): string =>
        JSON.stringify(value).slice(1, -1);

      const format = sanitize(font.format || "woff2");
      const fontDisplay = sanitize(font.fontDisplay || "swap");
      const fontWeight = font.fontWeight ?? 400;
      const fontStyle = sanitize(font.fontStyle || "normal");
      const fontFamily = sanitize(font.fontFamily);
      const src = sanitize(font.src);

      let css = `@font-face {
  font-family: "${fontFamily}";
  src: url('${src}') format('${format}');
  font-weight: ${fontWeight};
  font-style: ${fontStyle};
  font-display: ${fontDisplay};`;

      if (font.unicodeRange) {
        css += `\n  unicode-range: ${sanitize(font.unicodeRange)};`;
      }

      css += "\n}";
      return css;
    })
    .join("\n\n");
}

/**
 * Builds a full stylesheet from a Passport's tokens.
 * Output: @font-face rules + design token CSS variables (~30 lines).
 */
export function buildPassportStylesheet(tokens: Passport["tokens"]): string {
  const parts: string[] = [];

  const fontFace = generateFontFaceCSS(tokens.fonts);
  if (fontFace) parts.push(fontFace);

  const tokenCSS = generateDesignTokenCSS(tokens);
  if (tokenCSS) parts.push(tokenCSS);

  return parts.join("\n\n");
}
