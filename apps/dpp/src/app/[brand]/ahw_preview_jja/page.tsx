import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { screenshotProductData, screenshotContentData } from "@/screenshot-data/data";
import { screenshotThemeConfig } from "@/screenshot-data/config";
import { fetchThemePreview } from "@/lib/api";
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
  }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Theme Preview",
    robots: { index: false, follow: false },
  };
}

/**
 * Theme preview page for screenshot capture.
 *
 * Renders the brand's theme with demo product data.
 * Used by Browserless to capture theme screenshots for brands
 * that may not have any products yet.
 *
 * This route is public but safe - it only shows theme styling with generic demo data.
 * No sensitive information is exposed.
 */
export default async function ThemePreviewPage({ params }: PageProps) {
  const { brand: brandSlug } = await params;

  // Fetch theme data from API
  const themeData = await fetchThemePreview(brandSlug);

  if (!themeData) {
    notFound();
  }

  // Use screenshot demo data with the actual brand name
  const productData = {
    ...screenshotProductData,
    productAttributes: {
      ...screenshotProductData.productAttributes,
      brand: themeData.brandName,
    },
  };

  // Extract the brand name for header/footer
  const brandName = productData.productAttributes.brand;

  // Extract theme configuration (fallback to screenshot demo config)
  const themeConfig: ThemeConfig =
    (themeData.themeConfig as ThemeConfig) ?? screenshotThemeConfig;
  const themeStyles: ThemeStyles | undefined =
    (themeData.themeStyles as ThemeStyles) ?? undefined;

  // Google Fonts URL from stored theme
  const googleFontsUrl = themeData.googleFontsUrl ?? "";

  // Generate @font-face CSS from custom fonts when present
  const fontFaceCSS = generateFontFaceCSS(themeStyles?.customFonts);

  // Stylesheet URL is already resolved by the API
  const stylesheetUrl = themeData.stylesheetUrl ?? undefined;

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
        <Header themeConfig={themeConfig} brandName={brandName} />

        {/* Main content */}
        <ContentFrame
          data={productData}
          content={screenshotContentData}
          themeConfig={themeConfig}
        />

        {/* Footer */}
        <Footer themeConfig={themeConfig} brandName={brandName} />
      </div>
    </>
  );
}
