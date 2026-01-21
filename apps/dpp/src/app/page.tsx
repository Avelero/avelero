import { demoThemeConfig } from "@/demo-data/config";
import { demoContentData, demoProductData } from "@/demo-data/data";
import { ContentFrame, DemoCTA, Footer, Header } from "@v1/dpp-components";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Demo | Avelero",
  description:
    "Avelero is built for fashion brands that want to launch EU-compliant product passports in days, not months.",
};

export default function DemoPage() {
  // Demo page uses default styling from globals.css - no theme overrides needed
  const brandName = demoProductData.productAttributes.brand;

  return (
    <div className="dpp-root min-h-screen flex flex-col @container">
      {/* Header with spacer for fixed positioning */}
      <div style={{ height: "var(--header-height)" }} />
      <Header themeConfig={demoThemeConfig} brandName={brandName} />

      {/* Main content */}
      <ContentFrame
        data={demoProductData}
        content={demoContentData}
        themeConfig={demoThemeConfig}
      />

      {/* Demo CTA Button - sticky positioned above footer */}
      <DemoCTA />

      {/* Footer */}
      <Footer themeConfig={demoThemeConfig} brandName={brandName} />
    </div>
  );
}
