import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { demoThemeConfig } from "@/demo-data/config";
import { validateProductParams } from "@/lib/validation";
import {
  ThemeInjector,
  Header,
  ContentFrame,
  Footer,
  generateFontFaceCSS,
  type ThemeConfig,
  type ThemeStyles,
} from "@v1/dpp-components";
import { serviceDb } from "@v1/db/client";
import {
  getDppByProductUpid,
  transformToDppData,
} from "@v1/db/queries";
import { getPublicUrl } from "@v1/supabase/utils/storage-urls";
import { createClient } from "@v1/supabase/server";

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

  const data = await getDppByProductUpid(serviceDb, brand, productUpid);

  if (!data) {
    return {
      title: "Digital Product Passport",
      description:
        "View product sustainability information and supply chain data",
    };
  }

  return {
    title: `${data.brandName} | ${data.productName}`,
    description:
      data.productDescription ??
      "View product sustainability information and supply chain data",
  };
}

export default async function ProductDPPPage({ params }: PageProps) {
  const { brand, productUpid } = await params;

  // Validate params before querying
  if (!validateProductParams(brand, productUpid)) {
    notFound();
  }

  // Fetch all DPP data in optimized queries
  const data = await getDppByProductUpid(serviceDb, brand, productUpid);

  if (!data) {
    notFound();
  }

  // Transform to component format
  const productData = transformToDppData(data);

  // Extract theme configuration
  const themeConfig: ThemeConfig =
    (data.themeConfig as unknown as ThemeConfig) ?? demoThemeConfig;
  const themeStyles: ThemeStyles | undefined =
    data.themeStyles as unknown as ThemeStyles | undefined;

  // Google Fonts URL from stored theme
  const googleFontsUrl = data.googleFontsUrl ?? "";

  // Generate @font-face CSS from custom fonts when present
  const fontFaceCSS = generateFontFaceCSS(themeStyles?.customFonts);

  // Resolve Supabase public stylesheet URL if provided
  let publicStylesheetUrl: string | undefined;
  if (data.stylesheetPath) {
    const supabase = await createClient();
    publicStylesheetUrl =
      getPublicUrl(supabase, "dpp-themes", data.stylesheetPath) ?? undefined;
  }

  return (
    <>
      {/* Theme injection - Google Fonts and custom @font-face rules */}
      <ThemeInjector
        googleFontsUrl={googleFontsUrl}
        fontFaceCSS={fontFaceCSS}
      />

      {/* Supabase-hosted stylesheet overrides (if available) */}
      {publicStylesheetUrl && (
        <link rel="stylesheet" href={publicStylesheetUrl} />
      )}

      <div className="dpp-root min-h-screen flex flex-col">
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
