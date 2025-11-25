import type { Metadata } from 'next';
import { demoProductData } from '@/demo-data/data';
import { demoThemeConfig } from '@/demo-data/config';
import { generateThemeCSS } from '@/lib/theme/css-generator';
import { generateGoogleFontsUrlFromTypography } from '@/lib/theme/google-fonts';
import { ThemeInjector } from '@/components/theme/theme-injector';
import { Header } from '@/components/layout/header';
import { ContentFrame } from '@/components/layout/content-frame';
import { Footer } from '@/components/layout/footer';
import { DemoCTA } from '@/components/layout/demo-cta';

export const metadata: Metadata = {
  title: `${demoProductData.brandName} | ${demoProductData.title}`,
  description: demoProductData.description,
};

export default function DemoPage() {
  // Generate CSS variables from theme styles (using default styles, no override)
  const cssVars = generateThemeCSS(undefined);

  // No custom typography, so no Google Fonts needed
  const googleFontsUrl = '';

  return (
    <>
      {/* Theme injection - CSS variables (default styling) */}
      <ThemeInjector cssVars={cssVars} googleFontsUrl={googleFontsUrl} />

      <div className="min-h-screen flex flex-col">
        {/* Header with spacer for fixed positioning */}
        <div style={{ height: 'var(--header-height)' }} />
        <Header themeConfig={demoThemeConfig} brandName={demoProductData.brandName} />

        {/* Main content */}
        <ContentFrame data={demoProductData} themeConfig={demoThemeConfig} />

        {/* Demo CTA Button - sticky positioned above footer */}
        <DemoCTA />

        {/* Footer */}
        <Footer themeConfig={demoThemeConfig} />
      </div>
    </>
  );
}

