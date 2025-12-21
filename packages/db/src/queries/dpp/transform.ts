/**
 * DPP data transformation functions.
 * 
 * Transforms database query results to component-expected formats.
 */

import { countries, type CountryCode } from "@v1/selections";
import type { DppData } from "@v1/dpp-components";
import type { DppPublicData } from "./public.js";

/**
 * Get article number from variant identifiers using precedence:
 * barcode > GTIN > EAN > SKU
 * Returns empty string if no identifier is available.
 */
function getArticleNumber(data: DppPublicData): string {
  // Precedence: barcode > GTIN > EAN > SKU
  if (data.variantBarcode) return data.variantBarcode;
  if (data.variantGtin) return data.variantGtin;
  if (data.variantEan) return data.variantEan;
  if (data.variantSku) return data.variantSku;
  return "";
}

/**
 * Converts country code to country name.
 * Returns the code if no match is found.
 */
function getCountryName(code: string | null): string {
  if (!code) return "";
  const upperCode = code.toUpperCase() as CountryCode;
  const country = countries[upperCode];
  return country?.name ?? code;
}

/**
 * Transform DppPublicData (database format) to DppData (component format).
 *
 * Use this function to convert the query result to the format expected
 * by @v1/dpp-components.
 *
 * Article number logic:
 * - Only shown for variant-level DPPs (not product-level)
 * - Uses precedence: barcode > GTIN > EAN > SKU
 *
 * @param data - DppPublicData from getDppByProductHandle or getDppByVariantUpid
 * @returns DppData for frontend components
 */
export function transformToDppData(data: DppPublicData): DppData {
  return {
    productIdentifiers: {
      productId: Number(data.productId) || 0,
      productName: data.productName,
      productImage: data.productImage ?? "",
      // Article number only shown for variant-level DPPs
      // Uses precedence: barcode > GTIN > EAN > SKU
      articleNumber: getArticleNumber(data),
    },
    productAttributes: {
      description: data.productDescription ?? undefined,
      brand: data.brandName,
      category: data.categoryId
        ? { categoryId: Number(data.categoryId) || 0, category: data.categoryName ?? "" }
        : undefined,
      // Map variant attributes (max 3)
      attributes: data.variantAttributes.length > 0
        ? data.variantAttributes.slice(0, 3).map((attr) => ({
            name: attr.name,
            value: attr.value,
          }))
        : undefined,
    },
    environmental: {
      carbonEmissions: data.environment?.carbonKgCo2e
        ? { value: Number(data.environment.carbonKgCo2e), unit: "kgCO2e" }
        : undefined,
      waterUsage: data.environment?.waterLiters
        ? { value: Number(data.environment.waterLiters), unit: "liters" }
        : undefined,
      ecoClaims: data.ecoClaims.map((claim, index) => ({
        ecoClaimId: index,
        ecoClaim: claim,
      })),
    },
    materials: {
      composition: data.materials.map((m, index) => ({
        materialId: index,
        material: m.materialName,
        percentage: m.percentage,
        recyclable: m.recyclable ?? undefined,
        countryOfOrigin: getCountryName(m.countryOfOrigin),
        certification: m.certificationTitle
          ? { type: m.certificationTitle, code: "" }
          : undefined,
      })),
    },
    manufacturing: {
      manufacturer: data.manufacturerName
        ? {
            manufacturerId: 0,
            name: data.manufacturerName,
            countryCode: data.manufacturerCountryCode ?? undefined,
          }
        : undefined,
      supplyChain: data.journey.flatMap((step) =>
        step.facilities.map((f, index) => ({
          processStep: step.stepType
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" "),
          operator: {
            operatorId: index,
            legalName: f.displayName,
            city: f.city ?? undefined,
            countryCode: f.countryCode ?? undefined,
          },
        })),
      ),
    },
  };
}

