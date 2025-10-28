/**
 * CSS Generator for Theme Styles
 * Converts theme style objects into CSS custom properties
 */

import type { ThemeStyles, ComponentStyleOverride } from '@/types/theme-styles';
import { getFontFallback } from '@v1/selections';

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
      
      // Add units for numeric values (except lineHeight, opacity, etc.)
      if (
        typeof value === 'number' && 
        !['lineHeight', 'opacity'].includes(key) &&
        !key.includes('Weight') &&
        !key.includes('Spacing')
      ) {
        cssValue = `${value}px`;
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
          vars.push(`--type-${scaleKey}-letter-spacing: ${config.letterSpacing}`);
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
