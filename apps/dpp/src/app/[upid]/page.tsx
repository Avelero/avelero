import { demoThemeConfig } from "@/demo-data/config";
import { fetchPassportDpp } from "@/lib/api";
import { isValidUpid } from "@/lib/validation";
import {
  ContentFrame,
  Footer,
  Header,
  type ThemeConfig,
  type ThemeStyles,
  generateFontFaceCSS,
} from "@v1/dpp-components";
/**
 * Passport DPP Route - UPID-based URL structure.
 * URL: /{upid}
 *
 * This route fetches DPP data from the immutable publishing layer (snapshots)
 * rather than the normalized working layer. The UPID is a 16-character
 * alphanumeric identifier that uniquely identifies a published passport.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{
    upid: string;
  }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { upid } = await params;

  // Validate UPID format before querying
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

  // Build title with variant info if available
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

export default async function PassportDPPPage({ params }: PageProps) {
  const { upid } = await params;

  // Validate UPID format before querying
  if (!isValidUpid(upid)) {
    notFound();
  }

  // Fetch DPP data from API (using immutable publishing layer)
  const data = await fetchPassportDpp(upid);

  if (!data) {
    notFound();
  }

  // Check if the passport is inactive (variant was deleted)
  // Still show the last published version with an indicator
  const isInactive = data.passport?.isInactive ?? false;

  // Extract brand name from manufacturer
  const brandName = data.dppData.productAttributes.manufacturer?.name ?? "";

  // Extract theme configuration
  const themeConfig: ThemeConfig = data.themeConfig ?? demoThemeConfig;
  const themeStyles: ThemeStyles | undefined = data.themeStyles ?? undefined;

  // Google Fonts URL from stored theme
  const googleFontsUrl = data.googleFontsUrl ?? "";

  // Generate @font-face CSS from custom fonts when present
  const fontFaceCSS = generateFontFaceCSS(themeStyles?.customFonts);

  // Stylesheet URL is already resolved by the API
  const stylesheetUrl = data.stylesheetUrl ?? undefined;

  // Transform snapshot data to DppData format for components
  const productData = transformSnapshotToDppData(data.dppData);

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
      {fontFaceCSS && (
        // biome-ignore lint/security/noDangerouslySetInnerHtml: CSS is generated server-side from trusted theme configuration
        <style dangerouslySetInnerHTML={{ __html: fontFaceCSS }} />
      )}

      {/* Supabase-hosted stylesheet overrides (if available) */}
      {stylesheetUrl && <link rel="stylesheet" href={stylesheetUrl} />}

      <div className="dpp-root min-h-screen flex flex-col @container">
        {/* Header with spacer for fixed positioning */}
        <div style={{ height: "var(--header-height)" }} />
        <Header themeConfig={themeConfig} brandName={brandName} />

        {/* Inactive passport indicator */}
        {isInactive && (
          <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-4 mx-4 mt-4">
            <p className="font-medium">This passport is no longer active</p>
            <p className="text-sm">
              The product variant has been removed, but this historical record
              is preserved.
            </p>
          </div>
        )}

        {/* Main content */}
        <ContentFrame
          data={productData}
          content={{ similarProducts: [] }}
          themeConfig={themeConfig}
        />

        {/* Footer */}
        <Footer themeConfig={themeConfig} brandName={brandName} />
      </div>
    </>
  );
}

/**
 * Transform the JSON-LD snapshot structure to the DppData format expected by components.
 *
 * The snapshot structure is optimized for storage and immutability, while DppData
 * is optimized for component rendering. This function bridges the gap.
 */
function transformSnapshotToDppData(snapshot: PassportDppResponse["dppData"]) {
  return {
    // JSON-LD context (pass through)
    "@context": snapshot["@context"],
    "@type": snapshot["@type"],
    "@id": snapshot["@id"],

    // Product identifiers - map from snapshot format to DppData format
    productIdentifiers: {
      productId: 0, // Not available in snapshot (internal ID)
      productName: snapshot.productAttributes.name,
      productImage: snapshot.productAttributes.image ?? "",
      articleNumber:
        snapshot.productIdentifiers.barcode ??
        snapshot.productIdentifiers.sku ??
        "",
      ean: snapshot.productIdentifiers.barcode ?? undefined,
      gtin: undefined, // Not stored separately in snapshot
    },

    // Product attributes
    productAttributes: {
      description: snapshot.productAttributes.description ?? undefined,
      brand: snapshot.productAttributes.manufacturer?.name ?? "",
      category: snapshot.productAttributes.category
        ? {
            categoryId: 0, // Not available in snapshot
            category: snapshot.productAttributes.category,
          }
        : undefined,
      attributes: snapshot.productAttributes.attributes?.map((attr) => ({
        name: attr.name,
        value: attr.value,
      })),
      weight: snapshot.productAttributes.weight ?? undefined,
    },

    // Environmental data
    environmental: snapshot.environmental
      ? {
          waterUsage: snapshot.environmental.waterLiters ?? undefined,
          carbonEmissions: snapshot.environmental.carbonKgCo2e ?? undefined,
        }
      : undefined,

    // Materials
    materials: snapshot.materials
      ? {
          composition: snapshot.materials.composition.map((mat) => ({
            materialId: 0, // Not available in snapshot
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
                          mat.certification.testingInstitute.instituteName ??
                          "",
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

    // Manufacturing / Supply chain
    manufacturing: {
      manufacturer: snapshot.productAttributes.manufacturer
        ? {
            manufacturerId: 0, // Not available in snapshot
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
            operatorId: 0, // Not available in snapshot
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

/**
 * Response type from fetchPassportDpp
 */
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
  themeConfig: ThemeConfig | null;
  themeStyles: ThemeStyles | null;
  stylesheetUrl: string | null;
  googleFontsUrl: string | null;
  passport: {
    upid: string;
    isInactive: boolean;
    version: {
      id: string;
      versionNumber: number;
      schemaVersion: string;
      publishedAt: string;
      contentHash: string;
    } | null;
  };
}
