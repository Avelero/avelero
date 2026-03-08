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

// ─────────────────────────────────────────────────────────────────────────────
// Data Transformation
// ─────────────────────────────────────────────────────────────────────────────

function transformSnapshotToDppData(snapshot: PassportDppResponse["dppData"]) {
  return {
    "@context": snapshot["@context"],
    "@type": snapshot["@type"],
    "@id": snapshot["@id"],

    productIdentifiers: {
      productId: 0,
      productName: snapshot.productAttributes.name,
      productImage: snapshot.productAttributes.image ?? "",
      articleNumber:
        snapshot.productIdentifiers.barcode ??
        snapshot.productIdentifiers.sku ??
        "",
      ean: snapshot.productIdentifiers.barcode ?? undefined,
      gtin: undefined,
    },

    productAttributes: {
      description: snapshot.productAttributes.description ?? undefined,
      brand: snapshot.productAttributes.manufacturer?.name ?? "",
      category: snapshot.productAttributes.category
        ? {
            categoryId: 0,
            category: snapshot.productAttributes.category,
          }
        : undefined,
      attributes: snapshot.productAttributes.attributes?.map((attr) => ({
        name: attr.name,
        value: attr.value,
      })),
      weight: snapshot.productAttributes.weight ?? undefined,
    },

    environmental: snapshot.environmental
      ? {
          waterUsage: snapshot.environmental.waterLiters ?? undefined,
          carbonEmissions: snapshot.environmental.carbonKgCo2e ?? undefined,
        }
      : undefined,

    materials: snapshot.materials
      ? {
          composition: snapshot.materials.composition.map((mat) => ({
            materialId: 0,
            material: mat.material,
            percentage: mat.percentage ?? 0,
            recyclable: mat.recyclable ?? undefined,
            countryOfOrigin: mat.countryOfOrigin ?? undefined,
            certification: mat.certification
              ? {
                  type: mat.certification.title,
                  code: mat.certification.certificationCode ?? "",
                  testingInstitute: mat.certification.testingInstitute
                    ? {
                        legalName:
                          mat.certification.testingInstitute.instituteName ?? "",
                        email:
                          mat.certification.testingInstitute.instituteEmail ??
                          undefined,
                        website:
                          mat.certification.testingInstitute.instituteWebsite ??
                          undefined,
                        addressLine1:
                          mat.certification.testingInstitute
                            .instituteAddressLine1 ?? undefined,
                        addressLine2:
                          mat.certification.testingInstitute
                            .instituteAddressLine2 ?? undefined,
                        city:
                          mat.certification.testingInstitute.instituteCity ??
                          undefined,
                        state:
                          mat.certification.testingInstitute.instituteState ??
                          undefined,
                        postalCode:
                          mat.certification.testingInstitute.instituteZip ??
                          undefined,
                        country:
                          mat.certification.testingInstitute
                            .instituteCountryCode ?? undefined,
                      }
                    : undefined,
                }
              : undefined,
          })),
        }
      : undefined,

    manufacturing: {
      manufacturer: snapshot.productAttributes.manufacturer
        ? {
            manufacturerId: 0,
            name: snapshot.productAttributes.manufacturer.name,
            legalName:
              snapshot.productAttributes.manufacturer.legalName ?? undefined,
            email: snapshot.productAttributes.manufacturer.email ?? undefined,
            phone: snapshot.productAttributes.manufacturer.phone ?? undefined,
            website:
              snapshot.productAttributes.manufacturer.website ?? undefined,
            addressLine1:
              snapshot.productAttributes.manufacturer.addressLine1 ?? undefined,
            addressLine2:
              snapshot.productAttributes.manufacturer.addressLine2 ?? undefined,
            city: snapshot.productAttributes.manufacturer.city ?? undefined,
            state: snapshot.productAttributes.manufacturer.state ?? undefined,
            zip: snapshot.productAttributes.manufacturer.zip ?? undefined,
            countryCode:
              snapshot.productAttributes.manufacturer.countryCode ?? undefined,
          }
        : undefined,
      supplyChain: snapshot.supplyChain?.flatMap((step) =>
        step.operators.map((op) => ({
          processStep: step.stepType,
          operator: {
            operatorId: 0,
            name: op.displayName ?? undefined,
            legalName: op.legalName ?? "",
            email: op.email ?? undefined,
            phone: op.phone ?? undefined,
            website: op.website ?? undefined,
            addressLine1: op.addressLine1 ?? undefined,
            addressLine2: op.addressLine2 ?? undefined,
            city: op.city ?? undefined,
            state: op.state ?? undefined,
            zip: op.zip ?? undefined,
            countryCode: op.countryCode ?? undefined,
          },
        })),
      ),
    },
  };
}

interface PassportDppResponse {
  dppData: {
    "@context": {
      "@vocab": string;
      dpp: string;
      espr: string;
    };
    "@type": string;
    "@id": string;
    productIdentifiers: {
      upid: string;
      sku: string | null;
      barcode: string | null;
    };
    productAttributes: {
      name: string;
      description: string | null;
      image: string | null;
      category: string | null;
      manufacturer: {
        name: string;
        legalName: string | null;
        email: string | null;
        phone: string | null;
        website: string | null;
        addressLine1: string | null;
        addressLine2: string | null;
        city: string | null;
        state: string | null;
        zip: string | null;
        countryCode: string | null;
      } | null;
      attributes: Array<{ name: string; value: string }>;
      weight: { value: number; unit: string } | null;
    };
    environmental: {
      waterLiters: { value: number; unit: string } | null;
      carbonKgCo2e: { value: number; unit: string } | null;
    } | null;
    materials: {
      composition: Array<{
        material: string;
        percentage: number | null;
        recyclable: boolean | null;
        countryOfOrigin: string | null;
        certification: {
          title: string;
          certificationCode: string | null;
          testingInstitute: {
            instituteName: string | null;
            instituteEmail: string | null;
            instituteWebsite: string | null;
            instituteAddressLine1: string | null;
            instituteAddressLine2: string | null;
            instituteCity: string | null;
            instituteState: string | null;
            instituteZip: string | null;
            instituteCountryCode: string | null;
          } | null;
        } | null;
      }>;
    } | null;
    supplyChain: Array<{
      stepType: string;
      sortIndex: number;
      operators: Array<{
        displayName: string;
        legalName: string | null;
        email: string | null;
        phone: string | null;
        website: string | null;
        addressLine1: string | null;
        addressLine2: string | null;
        city: string | null;
        state: string | null;
        zip: string | null;
        countryCode: string | null;
      }>;
    }>;
    metadata: {
      schemaVersion: string;
      publishedAt: string;
      versionNumber: number;
    };
  };
}
