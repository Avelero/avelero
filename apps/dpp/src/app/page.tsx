import type { Metadata } from "next";
import { demoProductData } from "@/demo-data/data";
import { demoThemeConfig } from "@/demo-data/config";
import { Header, ContentFrame, Footer, DemoCTA } from "@v1/dpp-components";

export const metadata: Metadata = {
  title: "Demo | Avelero",
  description:
    "Avelero is built for fashion brands that want to launch EU-compliant product passports in days, not months.",
};

export default function DemoPage() {
  // Demo page uses default styling from globals.css - no theme overrides needed
  return (
    <div className="dpp-root min-h-screen flex flex-col @container">
      {/* Header with spacer for fixed positioning */}
      <div style={{ height: "var(--header-height)" }} />
      <Header
        themeConfig={demoThemeConfig}
        brandName={demoProductData.brandName}
      />

      {/* Main content */}
      <ContentFrame data={demoProductData} themeConfig={demoThemeConfig} />

      {/* Demo CTA Button - sticky positioned above footer */}
      <DemoCTA />

      {/* Footer */}
      <Footer
        themeConfig={demoThemeConfig}
        brandName={demoProductData.brandName}
      />
    </div>
  );
}
