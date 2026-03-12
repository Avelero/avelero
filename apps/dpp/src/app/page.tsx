/**
 * Public demo page for the passport experience.
 */

import {
  ContentFrame,
  DEMO_DATA,
  DemoCTA,
  Footer,
  Header,
  buildPassportStylesheet,
  createDemoPassport,
  generateGoogleFontsUrlFromTypography,
} from "@v1/dpp-components";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Demo | Avelero",
  description:
    "Avelero is built for fashion brands that want to launch EU-compliant product passports in days, not months.",
};

/**
 * Renders the public demo passport with the same font-loading path as production DPPs.
 */
export default function DemoPage() {
  const demoPassport = createDemoPassport();
  const brandName = DEMO_DATA.productAttributes.brand;
  const googleFontsUrl = generateGoogleFontsUrlFromTypography(
    demoPassport.tokens.typography,
    demoPassport.tokens.fonts,
  );
  const demoStylesheet = buildPassportStylesheet(demoPassport.tokens);

  return (
    <>
      {googleFontsUrl && (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossOrigin="anonymous"
          />
          <link rel="stylesheet" href={googleFontsUrl} />
        </>
      )}

      {demoStylesheet && (
        // biome-ignore lint/security/noDangerouslySetInnerHtml: CSS is generated from trusted demo theme tokens
        <style dangerouslySetInnerHTML={{ __html: demoStylesheet }} />
      )}

      <div className="dpp-root min-h-screen flex flex-col @container">
        {/* Header with spacer for fixed positioning */}
        <div style={{ height: "var(--header-height)" }} />
        <Header
          header={demoPassport.header}
          tokens={demoPassport.tokens}
          brandName={brandName}
        />

        {/* Main content */}
        <ContentFrame passport={demoPassport} data={DEMO_DATA} />

        {/* Demo CTA Button - sticky positioned above footer */}
        <DemoCTA />

        {/* Footer */}
        <Footer
          footer={demoPassport.footer}
          tokens={demoPassport.tokens}
          brandName={brandName}
        />
      </div>
    </>
  );
}
