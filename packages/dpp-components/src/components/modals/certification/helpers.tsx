/**
 * Certification modal helpers.
 *
 * Shared builders for certificate modal copy, fact rows, and map queries so
 * the theme-editor preview and materials modal stay in sync.
 */

import { countries } from "@v1/selections";
import { toExternalHref } from "../../../lib/url-utils";
import type { MaterialCertification } from "../../../types/data";
import type { ModalDataTableRow } from "../../modal";

function getCountryName(code: string | undefined): string {
  // Resolve an ISO country code into a readable label when possible.
  if (!code) return "";
  const country = countries[code.toUpperCase() as keyof typeof countries];
  return country?.name ?? code;
}

function formatDateFactValue(value: string) {
  // Collapse persisted timestamps to a stable calendar-date label in the modal.
  const isoDate = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  return isoDate ?? value;
}

export function buildCertificationModalDescription(materialName?: string) {
  // Keep the certificate description aligned across preview and runtime.
  if (materialName?.trim()) {
    return `This certification applies to ${materialName.trim().toLowerCase()} and is reported as part of this product passport.`;
  }

  return "This certification is recorded as part of the material traceability information for this product passport.";
}

export function buildCertificationModalFacts(
  certification: MaterialCertification | undefined,
): ModalDataTableRow[] {
  // Gather the available certification facts into label/value rows for the modal.
  const facts: ModalDataTableRow[] = [];
  const institute = certification?.testingInstitute;

  if (!certification) {
    return facts;
  }

  if (certification.code) {
    facts.push({
      key: "Certification code",
      label: "Certification code",
      value: certification.code,
    });
  }

  if (certification.issueDate) {
    facts.push({
      key: "Issue date",
      label: "Issue date",
      value: formatDateFactValue(certification.issueDate),
    });
  }

  if (certification.expiryDate) {
    facts.push({
      key: "Expiry date",
      label: "Expiry date",
      value: formatDateFactValue(certification.expiryDate),
    });
  }

  if (institute?.legalName) {
    facts.push({
      key: "Institute name",
      label: "Institute name",
      value: institute.legalName,
    });
  }

  if (institute?.website) {
    const certificationHref = toExternalHref(institute.website);

    facts.push({
      key: "Institute website",
      label: "Institute website",
      value: certificationHref ? (
        <a
          className="underline underline-offset-4"
          href={certificationHref}
          rel="noopener noreferrer"
          target="_blank"
        >
          {institute.website}
        </a>
      ) : (
        institute.website
      ),
    });
  }

  if (institute?.email) {
    facts.push({
      key: "Institute email",
      label: "Institute email",
      value: institute.email,
    });
  }

  if (institute?.phone) {
    facts.push({
      key: "Institute phone",
      label: "Institute phone",
      value: institute.phone,
    });
  }

  if (institute?.city) {
    facts.push({ key: "City", label: "City", value: institute.city });
  }

  if (institute?.country) {
    facts.push({
      key: "Country",
      label: "Country",
      value: getCountryName(institute.country) || institute.country,
    });
  }

  return facts;
}

export function buildCertificationModalMapQuery(
  certification: MaterialCertification | undefined,
  showExactLocation: boolean,
): string | null {
  // Collapse the testing institute address into either an exact or city-level Google Maps query.
  const institute = certification?.testingInstitute;
  const country = institute?.country
    ? getCountryName(institute.country) || institute.country
    : undefined;
  const queryParts = (
    showExactLocation
      ? [
          institute?.addressLine1,
          institute?.city,
          institute?.state,
          institute?.postalCode,
          country,
        ]
      : [institute?.city, country]
  )
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  if (queryParts.length === 0) {
    return null;
  }

  return queryParts.join(", ");
}
