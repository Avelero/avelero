import type { ThemeConfig } from '@/types/theme-config';
import { getFontFallback } from '@/lib/theme/google-fonts';

/**
 * Generate CSS custom properties from theme configuration
 */
export function generateCSSVariables(theme: ThemeConfig): string {
  const vars: string[] = [];

  // Colors
  for (const [key, value] of Object.entries(theme.colors)) {
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    vars.push(`--color-${cssKey}: ${value}`);
  }

  // Spacing
  for (const [key, value] of Object.entries(theme.spacing)) {
    vars.push(`--spacing-${key}: ${value}`);
  }

  // Typography - Typescale CSS variables (optional overrides)
  if (theme.typography) {
    const typescales = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body', 'body-sm', 'body-xs'] as const;
    
    for (const scale of typescales) {
      const scaleConfig = theme.typography[scale];
      if (scaleConfig) {
        const scaleKey = scale; // h1, body, body-sm, etc.
        
        if (scaleConfig.fontSize) {
          vars.push(`--type-${scaleKey}-size: ${scaleConfig.fontSize}`);
        }
        if (scaleConfig.fontWeight) {
          vars.push(`--type-${scaleKey}-weight: ${scaleConfig.fontWeight}`);
        }
        if (scaleConfig.fontFamily) {
          // Override font family for this specific scale with appropriate fallback
          const fallback = getFontFallback(null, scaleConfig.fontFamily);
          vars.push(`--type-${scaleKey}-family: "${scaleConfig.fontFamily}", ${fallback}`);
        }
        if (scaleConfig.lineHeight !== undefined) {
          vars.push(`--type-${scaleKey}-line-height: ${scaleConfig.lineHeight}`);
        }
        if (scaleConfig.letterSpacing) {
          vars.push(`--type-${scaleKey}-letter-spacing: ${scaleConfig.letterSpacing}`);
        }
      }
    }
  }

  // Border radius
  for (const [key, value] of Object.entries(theme.borders.radius)) {
    vars.push(`--radius-${key}: ${value}`);
  }
  
  // Customizable rounding (optional brand-specific border radius)
  if (theme.rounding) {
    vars.push(`--rounding: ${theme.rounding}`);
  }

  // Container
  vars.push(`--container-max-width: ${theme.container.maxWidth}`);

  return vars.join(';\n    ');
}


