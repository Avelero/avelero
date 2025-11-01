'use client';

import { useEffect } from 'react';

interface Props {
  cssVars: string;
  googleFontsUrl?: string;
}

// Global reference counters for font management
const fontReferenceCount = new Map<string, number>();
const preconnectReferenceCount = new Map<string, number>();

/**
 * Client component that injects theme CSS variables and Google Fonts into the document
 * This allows the parent page to remain a Server Component for SSR
 */
export function ThemeInjector({ cssVars, googleFontsUrl }: Props) {
  // Dynamically inject Google Fonts link tags with preconnect for performance
  useEffect(() => {
    if (!googleFontsUrl) return;

    // Increment reference count for this font URL
    const currentCount = fontReferenceCount.get(googleFontsUrl) || 0;
    fontReferenceCount.set(googleFontsUrl, currentCount + 1);

    // Check if this font link already exists
    const existingLink = document.querySelector(`link[href="${googleFontsUrl}"]`);
    if (existingLink) {
      // Font already exists, just increment reference count
      return () => {
        const newCount = fontReferenceCount.get(googleFontsUrl) || 0;
        if (newCount <= 1) {
          fontReferenceCount.delete(googleFontsUrl);
          existingLink.remove();
        } else {
          fontReferenceCount.set(googleFontsUrl, newCount - 1);
        }
      };
    }

    // Add preconnect for fonts.googleapis.com
    const preconnect1 = document.createElement('link');
    preconnect1.rel = 'preconnect';
    preconnect1.href = 'https://fonts.googleapis.com';
    preconnect1.id = 'preconnect-google-fonts';

    // Add preconnect for fonts.gstatic.com with crossorigin
    const preconnect2 = document.createElement('link');
    preconnect2.rel = 'preconnect';
    preconnect2.href = 'https://fonts.gstatic.com';
    preconnect2.crossOrigin = 'anonymous';
    preconnect2.id = 'preconnect-gstatic';

    // Create and inject the Google Fonts stylesheet link
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = googleFontsUrl;

    // Increment preconnect reference counts
    preconnectReferenceCount.set('preconnect-google-fonts', (preconnectReferenceCount.get('preconnect-google-fonts') || 0) + 1);
    preconnectReferenceCount.set('preconnect-gstatic', (preconnectReferenceCount.get('preconnect-gstatic') || 0) + 1);

    // Append in order: preconnects first, then stylesheet
    if (!document.getElementById('preconnect-google-fonts')) {
      document.head.appendChild(preconnect1);
    }
    if (!document.getElementById('preconnect-gstatic')) {
      document.head.appendChild(preconnect2);
    }
    document.head.appendChild(link);

    // Cleanup function to remove links when component unmounts or URL changes
    return () => {
      // Decrement font reference count
      const newFontCount = fontReferenceCount.get(googleFontsUrl) || 0;
      if (newFontCount <= 1) {
        fontReferenceCount.delete(googleFontsUrl);
        document.querySelector(`link[href="${googleFontsUrl}"]`)?.remove();
      } else {
        fontReferenceCount.set(googleFontsUrl, newFontCount - 1);
      }

      // Decrement preconnect reference counts
      const newPreconnect1Count = preconnectReferenceCount.get('preconnect-google-fonts') || 0;
      const newPreconnect2Count = preconnectReferenceCount.get('preconnect-gstatic') || 0;
      
      if (newPreconnect1Count <= 1) {
        preconnectReferenceCount.delete('preconnect-google-fonts');
        document.getElementById('preconnect-google-fonts')?.remove();
      } else {
        preconnectReferenceCount.set('preconnect-google-fonts', newPreconnect1Count - 1);
      }

      if (newPreconnect2Count <= 1) {
        preconnectReferenceCount.delete('preconnect-gstatic');
        document.getElementById('preconnect-gstatic')?.remove();
      } else {
        preconnectReferenceCount.set('preconnect-gstatic', newPreconnect2Count - 1);
      }
    };
  }, [googleFontsUrl]);

  // Only render style tag if there are CSS variables to inject
  if (!cssVars) {
    return null;
  }

  return (
    <style jsx global>{`
      :root {
        ${cssVars}
      }
    `}</style>
  );
}