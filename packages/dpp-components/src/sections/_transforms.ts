/**
 * Data transformers for section components.
 *
 * These convert DppData into display models consumed by section UI.
 * Moved from lib/dpp-data-transformers.ts into the sections module.
 */

import { countries } from "@v1/selections";
import type { DppData } from "../types/dpp-data";

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
  certification?: string;
  certificationUrl?: string;
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
        certification: formatCertificationLabel(m.certification?.type),
        certificationUrl: m.certification?.testingInstitute?.website,
      };
    }) ?? []
  );
}

// ─── Journey ─────────────────────────────────────────────────────────────────

export interface JourneyStageData {
  id: string;
  name: string;
  companies: Array<{ name: string; location: string; url?: string }>;
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
      companies: Array<{ name: string; location: string; url?: string }>;
    }
  >();

  for (const step of manufacturing?.supplyChain ?? []) {
    const processStep = step.processStep ?? "Unknown Step";
    const existing = journeyMap.get(processStep);
    const company = {
      name: step.operator.legalName,
      location: [
        step.operator.city,
        getCountryName(step.operator.countryCode) || step.operator.countryCode,
      ]
        .filter(Boolean)
        .join(", "),
      url: step.operator.website,
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
