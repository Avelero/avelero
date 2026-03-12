/**
 * Public UPID-based passport page.
 */

import { fetchPassportDpp } from "@/lib/api";
import { transformSnapshotToDppData } from "@/lib/transform-snapshot-to-dpp-data";
import { isValidUpid } from "@/lib/validation";
import {
  ContentFrame,
  Footer,
  Header,
  type Passport,
  buildPassportStylesheet,
  createDemoPassport,
  generateGoogleFontsUrlFromTypography,
} from "@v1/dpp-components";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{
    upid: string;
  }>;
}

/**
 * Builds the metadata for a passport page.
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { upid } = await params;

  if (!isValidUpid(upid)) {
    return {
      title: "Digital Product Passport",
      description:
        "View product sustainability information and supply chain data",
    };
  }

  const data = await fetchPassportDpp(upid);

  if (!data) {
    return {
      title: "Digital Product Passport",
      description:
        "View product sustainability information and supply chain data",
    };
  }

  const brandName = data.dppData.productAttributes.manufacturer?.name ?? "";
  const productName = data.dppData.productAttributes.name;
  const description = data.dppData.productAttributes.description;
  const attributes = data.dppData.productAttributes.attributes ?? [];

  const variantInfo = attributes
    .map((attr) => attr.value)
    .filter(Boolean)
    .join(" ");
  const productTitle = variantInfo
    ? `${productName} (${variantInfo})`
    : productName;

  return {
    title: brandName ? `${brandName} | ${productTitle}` : productTitle,
    description:
      description ||
      "View product sustainability information and supply chain data",
  };
}

/**
 * Renders a passport page using the persisted theme or the demo fallback theme.
 */
export default async function PassportDPPPage({ params }: PageProps) {
  const { upid } = await params;

  if (!isValidUpid(upid)) {
    notFound();
  }

  const data = await fetchPassportDpp(upid);

  if (!data) {
    notFound();
  }

  const isInactive = data.passport?.isInactive ?? false;
  const brandName = data.dppData.productAttributes.manufacturer?.name ?? "";

  // Use brand passport from API, fall back to demo passport
  const passport: Passport = data.brandPassport ?? createDemoPassport();

  // Generate public styling directly from the stored passport tokens.
  const googleFontsUrl = generateGoogleFontsUrlFromTypography(
    passport.tokens.typography,
    passport.tokens.fonts,
  );
  const inlineStylesheet = buildPassportStylesheet(passport.tokens);

  // Transform snapshot data to DppData format for components
  const productData = transformSnapshotToDppData(data.dppData);

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

      {inlineStylesheet && (
        // biome-ignore lint/security/noDangerouslySetInnerHtml: CSS is generated server-side from trusted theme configuration
        <style dangerouslySetInnerHTML={{ __html: inlineStylesheet }} />
      )}

      <div className="dpp-root min-h-screen flex flex-col @container">
        <div style={{ height: "var(--header-height)" }} />
        <Header
          header={passport.header}
          tokens={passport.tokens}
          brandName={brandName}
        />

        {isInactive && (
          <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-4 mx-4 mt-4">
            <p className="font-medium">This passport is no longer active</p>
            <p className="text-sm">
              The product variant has been removed, but this historical record
              is preserved.
            </p>
          </div>
        )}

        <ContentFrame
          passport={passport}
          data={productData}
          content={{ similarProducts: [] }}
        />

        <Footer
          footer={passport.footer}
          tokens={passport.tokens}
          brandName={brandName}
        />
      </div>
    </>
  );
}
