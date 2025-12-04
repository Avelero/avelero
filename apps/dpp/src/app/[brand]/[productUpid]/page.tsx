import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { demoThemeConfig } from "@/demo-data/config";
import { validateProductParams } from "@/lib/validation";
import { fetchProductDpp } from "@/lib/api";
import {
  Header,
  ContentFrame,
  Footer,
  generateFontFaceCSS,
  type ThemeConfig,
  type ThemeStyles,
} from "@v1/dpp-components";

interface PageProps {
  params: Promise<{
    brand: string;
    productUpid: string;
  }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { brand, productUpid } = await params;

  // Validate params before querying
  if (!validateProductParams(brand, productUpid)) {
    return {
      title: "Digital Product Passport",
      description:
        "View product sustainability information and supply chain data",
    };
  }

  const data = await fetchProductDpp(brand, productUpid);

  if (!data) {
    return {
      title: "Digital Product Passport",
      description:
        "View product sustainability information and supply chain data",
    };
  }

  return {
    title: `${data.dppData.brandName} | ${data.dppData.title}`,
    description:
      data.dppData.description ||
      "View product sustainability information and supply chain data",
  };
}

export default async function ProductDPPPage({ params }: PageProps) {
  const { brand, productUpid } = await params;

  // Validate params before querying
  if (!validateProductParams(brand, productUpid)) {
    notFound();
  }

  // Fetch DPP data from API (all data resolution happens server-side)
  const data = await fetchProductDpp(brand, productUpid);

  if (!data) {
    notFound();
  }

  // Extract data from API response
  const productData = data.dppData;

  // Extract theme configuration
  const themeConfig: ThemeConfig =
    data.themeConfig ?? demoThemeConfig;
  const themeStyles: ThemeStyles | undefined =
    data.themeStyles ?? undefined;

  // Google Fonts URL from stored theme
  const googleFontsUrl = data.googleFontsUrl ?? "";

  // Generate @font-face CSS from custom fonts when present
  const fontFaceCSS = generateFontFaceCSS(themeStyles?.customFonts);

  // Stylesheet URL is already resolved by the API
  const stylesheetUrl = data.stylesheetUrl ?? undefined;

  return (
    <>
      {/* Server-side font preloading - eliminates FOUT (Flash of Unstyled Text) */}
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

      {/* Custom @font-face CSS for CDN-hosted fonts */}
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: CSS is generated server-side from trusted theme configuration */}
      {fontFaceCSS && <style dangerouslySetInnerHTML={{ __html: fontFaceCSS }} />}

      {/* Supabase-hosted stylesheet overrides (if available) */}
      {stylesheetUrl && <link rel="stylesheet" href={stylesheetUrl} />}

      <div className="dpp-root min-h-screen flex flex-col @container">
        {/* Header with spacer for fixed positioning */}
        <div style={{ height: "var(--header-height)" }} />
        <Header themeConfig={themeConfig} brandName={productData.brandName} />

        {/* Main content */}
        <ContentFrame data={productData} themeConfig={themeConfig} />

        {/* Footer */}
        <Footer themeConfig={themeConfig} brandName={productData.brandName} />
      </div>
    </>
  );
}
