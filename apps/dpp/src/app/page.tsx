import type { Metadata } from 'next';
import { demoProductData } from '@/demo-data/data';
import { demoThemeConfig } from '@/demo-data/config';
import { generateThemeCSS } from '@/lib/theme/css-generator';
import { generateGoogleFontsUrlFromTypography } from '@/lib/theme/google-fonts';
import { ThemeInjector, Header, ContentFrame, Footer, DemoCTA } from '@v1/dpp-components';

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

      <div className="dpp-root min-h-screen flex flex-col @container">
        {/* Header with spacer for fixed positioning */}
        <div style={{ height: 'var(--header-height)' }} />
        <Header themeConfig={demoThemeConfig} brandName={demoProductData.brandName} />

        {/* Main content */}
        <ContentFrame data={demoProductData} themeConfig={demoThemeConfig} />

        {/* Demo CTA Button - sticky positioned above footer */}
        <DemoCTA />

        {/* Footer */}
        <Footer themeConfig={demoThemeConfig} brandName={demoProductData.brandName} />
      </div>
    </>
  );
}
