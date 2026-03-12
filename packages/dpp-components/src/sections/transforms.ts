/**
 * Data transformers for section components.
 *
 * These convert DppData into display models consumed by section UI.
 * Moved from lib/dpp-data-transformers.ts into the sections module.
 */

import { countries } from "@v1/selections";
import type { DppData, MaterialCertification, Operator } from "../types/data";

/** Get country name from ISO code, falling back to the code itself. */
export function getCountryName(code: string | undefined): string {
  if (!code) return "";
  const country = countries[code.toUpperCase() as keyof typeof countries];
  return country?.name ?? code;
}

// ─── Impact ──────────────────────────────────────────────────────────────────

export interface ImpactMetricDisplay {
  type: string;
  value: string;
  unit: string;
  icon: "leaf" | "drop" | "recycle" | "factory";
  iconColor?: string;
}

export function transformImpactMetrics(data: DppData): ImpactMetricDisplay[] {
  // Map environmental data into the redesigned card labels and icon accents.
  const { environmental } = data;
  const metrics: ImpactMetricDisplay[] = [];

  if (environmental?.carbonEmissions) {
    metrics.push({
      type: "Carbon emissions",
      value: String(environmental.carbonEmissions.value),
      unit: environmental.carbonEmissions.unit,
      icon: "leaf",
      iconColor: "#10A651",
    });
  }
  if (environmental?.waterUsage) {
    metrics.push({
      type: "Water usage",
      value: String(environmental.waterUsage.value),
      unit: environmental.waterUsage.unit,
      icon: "drop",
      iconColor: "#1616F3",
    });
  }

  return metrics;
}

// ─── Materials ───────────────────────────────────────────────────────────────

export interface MaterialDisplayData {
  percentage: number;
  type: string;
  origin: string;
  certification?: MaterialCertification;
}

function resolveCountryLabel(value: string | undefined): string {
  // Convert ISO codes into readable country labels while passing through free text.
  if (!value) return "";
  const normalizedCountry = getCountryName(value);
  return normalizedCountry || value;
}

function formatLocationLabel(parts: Array<string | undefined>): string {
  // Join the available city/country segments into a single display label.
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

function formatCertificationLabel(
  value: string | undefined,
): string | undefined {
  // Normalize all-caps certification names into the mixed-case treatment used in the redesign.
  if (!value) return undefined;

  return value
    .split(/(\([^)]*\))/g)
    .map((segment) => {
      if (!segment) return segment;
      if (segment.startsWith("(") && segment.endsWith(")")) return segment;

      return segment
        .toLowerCase()
        .replace(/\b([a-z])/g, (match) => match.toUpperCase());
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

export function transformMaterials(data: DppData): MaterialDisplayData[] {
  // Prefer explicit certification/testing institute locations, then fall back to raw-material operators.
  const { materials } = data;
  const rawMaterialOperators = (data.manufacturing?.supplyChain ?? [])
    .filter((step) => step.processStep?.toUpperCase() === "RAW MATERIAL")
    .map((step) => step.operator);

  return (
    materials?.composition?.map((m, index) => {
      const institute = m.certification?.testingInstitute;
      const rawMaterialOperator = rawMaterialOperators[index];
      const certificationType = formatCertificationLabel(m.certification?.type);

      return {
        percentage: m.percentage,
        type: m.material,
        origin: formatLocationLabel([
          institute?.city || rawMaterialOperator?.city,
          institute?.country
            ? resolveCountryLabel(institute.country)
            : rawMaterialOperator?.countryCode
              ? resolveCountryLabel(rawMaterialOperator.countryCode)
              : resolveCountryLabel(m.countryOfOrigin),
        ]),
        certification: m.certification
          ? {
              ...m.certification,
              type: certificationType ?? m.certification.type,
            }
          : undefined,
      };
    }) ?? []
  );
}

// ─── Journey ─────────────────────────────────────────────────────────────────

export type JourneyCompanyData = Omit<Operator, "name"> & {
  location: string;
  name: string;
};

export interface JourneyStageData {
  id: string;
  name: string;
  companies: JourneyCompanyData[];
}

function formatProcessStepLabel(value: string | undefined): string {
  // Convert raw supply-chain step codes into readable journey stage labels.
  if (!value) return "Unknown Step";

  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

export function transformJourney(data: DppData): JourneyStageData[] {
  // Group supply-chain operators by process step for the redesigned journey timeline.
  const { manufacturing } = data;
  const journeyMap = new Map<
    string,
    {
      id: string;
      name: string;
      companies: JourneyCompanyData[];
    }
  >();

  for (const step of manufacturing?.supplyChain ?? []) {
    const processStep = step.processStep ?? "Unknown Step";
    const existing = journeyMap.get(processStep);
    const companyName =
      step.operator.name?.trim() ||
      step.operator.legalName?.trim() ||
      "Unknown Operator";
    const company = {
      addressLine1: step.operator.addressLine1,
      addressLine2: step.operator.addressLine2,
      city: step.operator.city,
      countryCode: step.operator.countryCode,
      email: step.operator.email,
      legalName: step.operator.legalName,
      location: [
        step.operator.city,
        getCountryName(step.operator.countryCode) || step.operator.countryCode,
      ]
        .filter(Boolean)
        .join(", "),
      name: companyName,
      operatorId: step.operator.operatorId,
      phone: step.operator.phone,
      state: step.operator.state,
      website: step.operator.website,
      zip: step.operator.zip,
    };

    if (existing) {
      existing.companies.push(company);
    } else {
      journeyMap.set(processStep, {
        id: processStep,
        name: formatProcessStepLabel(processStep),
        companies: [company],
      });
    }
  }

  return Array.from(journeyMap.values());
}
