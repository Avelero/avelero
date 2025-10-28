'use client';

import { useEffect } from 'react';

interface Props {
  cssVars: string;
  googleFontsUrl?: string;
}

/**
 * Client component that injects theme CSS variables and Google Fonts into the document
 * This allows the parent page to remain a Server Component for SSR
 */
export function ThemeInjector({ cssVars, googleFontsUrl }: Props) {
  // Dynamically inject Google Fonts link tags with preconnect for performance
  useEffect(() => {
    if (!googleFontsUrl) return;

    // Check if this font link already exists
    const existingLink = document.querySelector(`link[href="${googleFontsUrl}"]`);
    if (existingLink) return;

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
    link.id = 'google-fonts-theme';

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
      document.getElementById('google-fonts-theme')?.remove();
      document.getElementById('preconnect-google-fonts')?.remove();
      document.getElementById('preconnect-gstatic')?.remove();
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