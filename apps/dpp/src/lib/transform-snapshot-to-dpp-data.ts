/**
 * Snapshot-to-DPP transform helpers.
 *
 * Converts the immutable published snapshot shape into the DppData structure
 * consumed by the DPP component package.
 */

import type { DppData } from "@v1/dpp-components";
import type { PassportDppApiResponse } from "./api";

type SnapshotCertification = NonNullable<
  NonNullable<PassportDppApiResponse["dppData"]["materials"]>["composition"][number]["certification"]
>;
type SnapshotTestingInstitute = SnapshotCertification["testingInstitute"];

/**
 * Map testing institute details from the snapshot into component-friendly data.
 */
function mapTestingInstitute(
  testingInstitute: SnapshotTestingInstitute | null | undefined,
) {
  if (!testingInstitute) {
    return undefined;
  }

  return {
    legalName: testingInstitute.instituteName ?? "",
    email: testingInstitute.instituteEmail ?? undefined,
    website: testingInstitute.instituteWebsite ?? undefined,
    addressLine1: testingInstitute.instituteAddressLine1 ?? undefined,
    addressLine2: testingInstitute.instituteAddressLine2 ?? undefined,
    city: testingInstitute.instituteCity ?? undefined,
    state: testingInstitute.instituteState ?? undefined,
    postalCode: testingInstitute.instituteZip ?? undefined,
    country: testingInstitute.instituteCountryCode ?? undefined,
  };
}

/**
 * Convert a published snapshot into the DppData format expected by components.
 */
export function transformSnapshotToDppData(
  snapshot: PassportDppApiResponse["dppData"],
): DppData {
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
          composition: snapshot.materials.composition.map((material) => ({
            materialId: 0,
            material: material.material,
            percentage: material.percentage ?? 0,
            recyclable: material.recyclable ?? undefined,
            countryOfOrigin: material.countryOfOrigin ?? undefined,
            certification: material.certification
              ? {
                  type: material.certification.title,
                  code: material.certification.certificationCode ?? "",
                  issueDate: material.certification.issueDate ?? undefined,
                  expiryDate: material.certification.expiryDate ?? undefined,
                  documentUrl: material.certification.documentUrl ?? undefined,
                  testingInstitute: mapTestingInstitute(
                    material.certification.testingInstitute,
                  ),
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
        step.operators.map((operator) => ({
          processStep: step.stepType,
          operator: {
            operatorId: 0,
            name: operator.displayName ?? undefined,
            legalName: operator.legalName ?? "",
            email: operator.email ?? undefined,
            phone: operator.phone ?? undefined,
            website: operator.website ?? undefined,
            addressLine1: operator.addressLine1 ?? undefined,
            addressLine2: operator.addressLine2 ?? undefined,
            city: operator.city ?? undefined,
            state: operator.state ?? undefined,
            zip: operator.zip ?? undefined,
            countryCode: operator.countryCode ?? undefined,
          },
        })),
      ),
    },
  };
}
