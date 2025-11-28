import { getFontFallback } from "@v1/selections/fonts";
import type { ComponentStyleOverride, CustomFont, ThemeStyles } from "../types";

/**
 * Properties that should receive 'px' units when numeric
 */
const PX_UNIT_PROPERTIES = new Set([
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "top",
  "left",
  "right",
  "bottom",
  "borderWidth",
  "fontSize",
  "gap",
  "borderRadius",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomLeftRadius",
  "borderBottomRightRadius",
]);

/**
 * Converts camelCase property names to kebab-case CSS property names
 */
function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}

/**
 * Converts component class name to CSS variable prefix
 * e.g., "product__title" -> "product-title"
 */
function classToVarPrefix(className: string): string {
  return className.replace(/__/g, "-");
}

/**
 * Generates CSS variables for a component style override
 */
function generateComponentCSS(
  className: string,
  styles: ComponentStyleOverride,
): string[] {
  const vars: string[] = [];
  const prefix = classToVarPrefix(className);

  for (const [key, value] of Object.entries(styles)) {
    if (value !== undefined && value !== null) {
      const cssProperty = camelToKebab(key);
      const cssVarName = `--${prefix}-${cssProperty}`;

      let cssValue = String(value);

      // Add font fallback for fontFamily
      if (key === "fontFamily" && typeof value === "string") {
        const fallback = getFontFallback(value);
        cssValue = `"${value}", ${fallback}`;
      }

      // Add units for numeric values based on property type
      if (typeof value === "number") {
        if (key === "letterSpacing") {
          cssValue = `${value}px`;
        } else if (PX_UNIT_PROPERTIES.has(key)) {
          cssValue = `${value}px`;
        }
        // lineHeight, opacity, fontWeight remain unitless
      }

      vars.push(`${cssVarName}: ${cssValue}`);
    }
  }

  return vars;
}

/**
 * Generates CSS variables for design tokens (colors, typography)
 */
function generateDesignTokenCSS(themeStyles: ThemeStyles): string[] {
  const vars: string[] = [];

  // Generate color variables
  if (themeStyles.colors) {
    for (const [key, value] of Object.entries(themeStyles.colors)) {
      if (value !== undefined && value !== null) {
        const cssVarName = `--${camelToKebab(key)}`;
        vars.push(`${cssVarName}: ${value}`);
      }
    }
  }

  // Generate typography variables
  if (themeStyles.typography) {
    for (const [scale, config] of Object.entries(themeStyles.typography)) {
      if (config) {
        const scaleKey = scale; // h1, body, body-sm, etc.

        if (config.fontSize !== undefined) {
          // Convert numeric px values to rem (divide by 16)
          const fontSizeValue =
            typeof config.fontSize === "number"
              ? `${config.fontSize / 16}rem`
              : config.fontSize;
          vars.push(`--type-${scaleKey}-size: ${fontSizeValue}`);
        }
        if (config.fontWeight !== undefined) {
          vars.push(`--type-${scaleKey}-weight: ${config.fontWeight}`);
        }
        if (config.fontFamily !== undefined) {
          const fallback = getFontFallback(config.fontFamily);
          vars.push(
            `--type-${scaleKey}-family: "${config.fontFamily}", ${fallback}`,
          );
        }
        if (config.lineHeight !== undefined) {
          vars.push(`--type-${scaleKey}-line-height: ${config.lineHeight}`);
        }
        if (config.letterSpacing !== undefined) {
          const letterSpacingValue =
            typeof config.letterSpacing === "number"
              ? `${config.letterSpacing}px`
              : config.letterSpacing;
          vars.push(`--type-${scaleKey}-letter-spacing: ${letterSpacingValue}`);
        }
      }
    }
  }

  return vars;
}

/**
 * Generates CSS custom properties from theme styles and wraps them in .dpp-root
 * This scopes the overrides to the DPP preview container, matching globals.css.
 * Returns an empty string if there are no overrides.
 */
export function generateThemeCSS(themeStyles?: ThemeStyles): string {
  if (!themeStyles) {
    return "";
  }

  const vars: string[] = [];

  // Generate design token CSS first (these override .dpp-root defaults)
  const designTokenVars = generateDesignTokenCSS(themeStyles);
  vars.push(...designTokenVars);

  // Generate component class CSS
  for (const [className, styles] of Object.entries(themeStyles)) {
    // Skip design token properties
    if (
      className === "colors" ||
      className === "typography" ||
      className === "customFonts"
    ) {
      continue;
    }

    // Skip non-component properties
    if (typeof styles !== "object" || styles === null) {
      continue;
    }

    const componentVars = generateComponentCSS(
      className,
      styles as ComponentStyleOverride,
    );
    vars.push(...componentVars);
  }

  if (vars.length === 0) {
    return "";
  }

  // Scope all CSS variables under .dpp-root to match globals.css
  return `.dpp-root {\n  ${vars.join(";\n  ")};\n}`;
}

/**
 * Generates @font-face CSS rules from custom fonts
 * @param customFonts - Array of custom font definitions
 * @returns CSS string with @font-face declarations
 */
export function generateFontFaceCSS(customFonts?: CustomFont[]): string {
  if (!customFonts || customFonts.length === 0) {
    return "";
  }

  return customFonts
    .map((font) => {
      // Sanitize values to prevent CSS injection
      const sanitize = (value: string): string => {
        // Use JSON.stringify to escape quotes and special characters, then remove outer quotes
        return JSON.stringify(value).slice(1, -1);
      };

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
 * Builds a full stylesheet string that combines custom fonts and theme CSS.
 */
export function buildThemeStylesheet(options: {
  themeStyles?: ThemeStyles;
  includeFontFaces?: boolean;
}): string {
  const { themeStyles, includeFontFaces = true } = options;
  const cssParts: string[] = [];

  if (includeFontFaces) {
    const fontFaceCss = generateFontFaceCSS(themeStyles?.customFonts);
    if (fontFaceCss) {
      cssParts.push(fontFaceCss);
    }
  }

  const overrides = generateThemeCSS(themeStyles);
  if (overrides) {
    cssParts.push(overrides);
  }

  return cssParts.join("\n\n");
}
