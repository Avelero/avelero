/**
 * CSS Generator for Theme Styles
 * Converts theme style objects into CSS custom properties
 */

import type { ThemeStyles, ComponentStyleOverride, CustomFont } from '@/types/theme-styles';
import { getFontFallback } from '@v1/selections/fonts';

/**
 * Properties that should receive 'px' units when numeric
 */
const PX_UNIT_PROPERTIES = new Set([
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'top', 'left', 'right', 'bottom',
  'borderWidth', 'fontSize', 'gap',
  'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius', 
  'borderBottomLeftRadius', 'borderBottomRightRadius'
]);

/**
 * Converts camelCase property names to kebab-case CSS property names
 */
function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

/**
 * Converts component class name to CSS variable prefix
 * e.g., "product__title" -> "product-title"
 */
function classToVarPrefix(className: string): string {
  return className.replace(/__/g, '-');
}

/**
 * Generates CSS variables for a component style override
 */
function generateComponentCSS(
  className: string,
  styles: ComponentStyleOverride
): string[] {
  const vars: string[] = [];
  const prefix = classToVarPrefix(className);

  for (const [key, value] of Object.entries(styles)) {
    if (value !== undefined && value !== null) {
      const cssProperty = camelToKebab(key);
      const cssVarName = `--${prefix}-${cssProperty}`;
      
      // Handle special cases
      let cssValue = String(value);
      
      // Add font fallback for fontFamily
      if (key === 'fontFamily' && typeof value === 'string') {
        const fallback = getFontFallback(value);
        cssValue = `"${value}", ${fallback}`;
      }
      
      // Add units for numeric values based on property type
      if (typeof value === 'number') {
        if (key === 'letterSpacing') {
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
          vars.push(`--type-${scaleKey}-size: ${config.fontSize}`);
        }
        if (config.fontWeight !== undefined) {
          vars.push(`--type-${scaleKey}-weight: ${config.fontWeight}`);
        }
        if (config.fontFamily !== undefined) {
          const fallback = getFontFallback(config.fontFamily);
          vars.push(`--type-${scaleKey}-family: "${config.fontFamily}", ${fallback}`);
        }
        if (config.lineHeight !== undefined) {
          vars.push(`--type-${scaleKey}-line-height: ${config.lineHeight}`);
        }
        if (config.letterSpacing !== undefined) {
          const letterSpacingValue = typeof config.letterSpacing === 'number' 
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
 * Main function to generate CSS custom properties from theme styles
 * @param themeStyles - Theme style overrides (optional)
 * @returns CSS string with custom properties
 */
export function generateThemeCSS(themeStyles?: ThemeStyles): string {
  if (!themeStyles) {
    return '';
  }

  const vars: string[] = [];

  // Generate design token CSS first (these override :root defaults)
  const designTokenVars = generateDesignTokenCSS(themeStyles);
  vars.push(...designTokenVars);

  // Generate component class CSS
  for (const [className, styles] of Object.entries(themeStyles)) {
    // Skip design token properties
    if (className === 'colors' || className === 'typography') {
      continue;
    }

    // Skip non-component properties
    if (typeof styles !== 'object' || styles === null) {
      continue;
    }

    const componentVars = generateComponentCSS(className, styles as ComponentStyleOverride);
    vars.push(...componentVars);
  }

  return vars.join(';\n    ');
}

/**
 * Generates @font-face CSS rules from custom fonts
 * @param customFonts - Array of custom font definitions
 * @returns CSS string with @font-face declarations
 */
export function generateFontFaceCSS(customFonts?: CustomFont[]): string {
  if (!customFonts || customFonts.length === 0) {
    return '';
  }

  return customFonts
    .map((font) => {
      const format = font.format || 'woff2';
      const fontDisplay = font.fontDisplay || 'swap';
      const fontWeight = font.fontWeight ?? 400;
      const fontStyle = font.fontStyle || 'normal';
      
      let css = `@font-face {
  font-family: "${font.fontFamily}";
  src: url('${font.src}') format('${format}');
  font-weight: ${fontWeight};
  font-style: ${fontStyle};
  font-display: ${fontDisplay};`;

      if (font.unicodeRange) {
        css += `\n  unicode-range: ${font.unicodeRange};`;
      }

      css += '\n}';
      return css;
    })
    .join('\n\n');
}
