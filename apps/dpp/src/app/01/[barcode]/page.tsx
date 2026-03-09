/**
 * GS1 Digital Link DPP Route - Barcode-based URL structure.
 * URL: /01/{barcode}
 *
 * This route resolves barcodes (GTINs) to passports within the context
 * of a custom domain. The domain identifies the brand, and the barcode
 * is scoped to that brand's products.
 *
 * IMPORTANT: This route only works on custom domains. Requests to
 * passport.avelero.com/01/... are rejected by the proxy with a 404.
 */
import { demoPassport } from "@/demo-data/config";
import { fetchPassportByBarcode } from "@/lib/api";
import { resolveDomain } from "@/lib/domain";
import { transformSnapshotToDppData } from "@/lib/transform-snapshot-to-dpp-data";
import { isValidBarcode } from "@/lib/validation";
import {
  ContentFrame,
  Footer,
  Header,
  type Passport,
  buildPassportStylesheet,
  generateGoogleFontsUrlFromTypography,
} from "@v1/dpp-components";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ barcode: string }>;
  searchParams: Promise<{ _domain?: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the metadata for a barcode-based passport page.
 */
export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { barcode } = await params;
  const { _domain } = await searchParams;

  if (!isValidBarcode(barcode) || !_domain) {
    return {
      title: "Digital Product Passport",
      description:
        "View product sustainability information and supply chain data",
    };
  }

  const resolvedDomain = await resolveDomain(_domain);
  if (!resolvedDomain) {
    return {
      title: "Digital Product Passport",
      description:
        "View product sustainability information and supply chain data",
    };
  }

  const data = await fetchPassportByBarcode(resolvedDomain.brandId, barcode);
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

// ─────────────────────────────────────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders a barcode-based passport page using the persisted theme or demo fallback.
 */
export default async function BarcodeDPPPage({
  params,
  searchParams,
}: PageProps) {
  const { barcode } = await params;
  const { _domain } = await searchParams;

  if (!isValidBarcode(barcode)) {
    notFound();
  }

  if (!_domain) {
    console.error(
      "[Barcode] Missing _domain parameter - proxy misconfiguration?",
    );
    notFound();
  }

  const resolvedDomain = await resolveDomain(_domain);

  if (!resolvedDomain) {
    notFound();
  }

  const data = await fetchPassportByBarcode(resolvedDomain.brandId, barcode);

  if (!data) {
    notFound();
  }

  const isInactive = data.passport?.isInactive ?? false;
  const brandName = data.dppData.productAttributes.manufacturer?.name ?? "";

  // Use brand passport from API, fall back to demo passport
  const passport: Passport = data.brandPassport ?? demoPassport;

  const googleFontsUrl =
    data.googleFontsUrl ??
    generateGoogleFontsUrlFromTypography(
      passport.tokens.typography,
      passport.tokens.fonts,
    );
  const stylesheetUrl = data.stylesheetUrl ?? undefined;
  const inlineStylesheet = stylesheetUrl
    ? ""
    : buildPassportStylesheet(passport.tokens);

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

      {stylesheetUrl && <link rel="stylesheet" href={stylesheetUrl} />}

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
