import type { ThemeStyles } from '@/types/theme-styles';

/**
 * Mock theme styles for development
 * Contains only style overrides (colors, typography, component classes)
 * Each brand demonstrates different levels of customization
 */
export const mockThemeStyles: Record<string, ThemeStyles> = {
  'acme': {
    // Minimal overrides - mostly uses default styling
    colors: {
      primary: '#1E2040',
      foreground: '#62637A',
      background: '#FFFFFF',
      border: '#E9E9EC',
      highlight: '#0000FF',
    },
  },
  'mrmarvis': {
    // Typography-focused customization with Figtree and Noto Serif Display
    colors: {
      primary: '#071933',
      foreground: 'rgba(7, 25, 51, 0.7)',
      background: '#FFFFFF',
      border: '#E5E8EB',
      highlight: '#3371A5',
    },
    typography: {
      h1: {
        fontSize: '2rem',
        fontFamily: 'Figtree',
        fontWeight: 700,
        lineHeight: 1.3,
        letterSpacing: '0rem',
      },
      h2: {
        fontFamily: 'Figtree',
        fontWeight: 700,
      },
      h3: {
        fontFamily: 'Figtree',
        fontWeight: 640,
      },
      h4: {
        fontFamily: 'Figtree',
        fontWeight: 640,
      },
      h5: {
        fontSize: '2rem',
        fontFamily: 'Noto Serif Display',
        fontWeight: 400,
      },
      h6: {
        fontSize: '1.25rem',
        fontFamily: 'Figtree',
        fontWeight: 580,
        lineHeight: 1.3,
        letterSpacing: '0.0008rem',
      },
      body: {
        fontSize: '1rem',
        fontFamily: 'Figtree',
        fontWeight: 430,
      },
      'body-sm': {
        fontSize: '0.875rem',
        fontFamily: 'Figtree',
        fontWeight: 430,
        lineHeight: 1.5,
        letterSpacing: '0.002rem',
      },
      'body-xs': {
        fontSize: '0.75rem',
        fontFamily: 'Figtree',
        fontWeight: 430,
      },
    },
    // Component-specific overrides
    'product__title': {
      lineHeight: 1.3,
    },
    'impact-card': {
      borderRadius: '0.75rem',
    },
    'materials-card': {
      borderRadius: '0.75rem',
    },
    'journey-card': {
      borderRadius: '0.75rem',
    },
  },
  'fillingpieces': {
    // Heavy customization with Public Sans and custom styling
    colors: {
      primary: '#000000',
      foreground: '#000000',
      background: '#FFFFFF',
      border: '#000000',
      highlight: '#0000FF',
    },
    typography: {
      h1: {
        fontSize: '2rem',
        fontFamily: 'Public Sans',
        fontWeight: 500,
        lineHeight: 0.9,
        letterSpacing: '-0.04em',
      },
      h2: {
        fontFamily: 'Public Sans',
        fontWeight: 700,
      },
      h3: {
        fontFamily: 'Public Sans',
        fontWeight: 640,
      },
      h4: {
        fontFamily: 'Public Sans',
        fontWeight: 640,
      },
      h5: {
        fontSize: '2rem',
        fontFamily: 'Public Sans',
        fontWeight: 400,
      },
      h6: {
        fontSize: '1.25rem',
        fontFamily: 'Public Sans',
        fontWeight: 580,
        lineHeight: 1.3,
        letterSpacing: '0.0008rem',
      },
      body: {
        fontSize: '0.875rem',
        fontFamily: 'Public Sans',
        fontWeight: 500,
        lineHeight: 1.20,
        letterSpacing: '-0.02rem',
      },
      'body-sm': {
        fontSize: '0.875rem',
        fontFamily: 'Public Sans',
        fontWeight: 300,
        lineHeight: 1.20,
        letterSpacing: '-0.02rem',
      },
      'body-xs': {
        fontSize: '0.75rem',
        fontFamily: 'Public Sans',
        fontWeight: 430,
      },
    },
    // Component-specific overrides with minimal border radius
    'product__title': {
      lineHeight: 0.9,
      letterSpacing: '-0.04em',
    },
    'product__description': {
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: 1.20,
      letterSpacing: '-0.02rem',
    },
    'impact-card': {
      borderRadius: '0.125rem',
      borderColor: '#000000',
    },
    'materials-card': {
      borderRadius: '0.125rem',
      borderColor: '#000000',
    },
    'journey-card': {
      borderRadius: '0.125rem',
      borderColor: '#000000',
    },
    'product-details': {
      borderRadius: '0.125rem',
      borderColor: '#000000',
    },
    'menu-button': {
      borderRadius: '0.125rem',
      borderColor: '#000000',
    },
  },
};
