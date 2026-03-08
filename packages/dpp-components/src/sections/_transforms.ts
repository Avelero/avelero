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
}

export function transformImpactMetrics(data: DppData): ImpactMetricDisplay[] {
  const { environmental } = data;
  const metrics: ImpactMetricDisplay[] = [];

  if (environmental?.carbonEmissions) {
    metrics.push({
      type: "Carbon Footprint",
      value: String(environmental.carbonEmissions.value),
      unit: environmental.carbonEmissions.unit,
      icon: "leaf",
    });
  }
  if (environmental?.waterUsage) {
    metrics.push({
      type: "Water Usage",
      value: String(environmental.waterUsage.value),
      unit: environmental.waterUsage.unit,
      icon: "drop",
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

export function transformMaterials(data: DppData): MaterialDisplayData[] {
  const { materials } = data;
  return (
    materials?.composition?.map((m) => ({
      percentage: m.percentage,
      type: m.material,
      origin: getCountryName(m.countryOfOrigin) || m.countryOfOrigin || "",
      certification: m.certification?.type,
      certificationUrl: m.certification?.testingInstitute?.website,
    })) ?? []
  );
}

// ─── Journey ─────────────────────────────────────────────────────────────────

export interface JourneyStageData {
  id: string;
  name: string;
  companies: Array<{ name: string; location: string }>;
}

export function transformJourney(data: DppData): JourneyStageData[] {
  const { manufacturing } = data;
  const journeyMap = new Map<
    string,
    {
      id: string;
      name: string;
      companies: Array<{ name: string; location: string }>;
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
    };

    if (existing) {
      existing.companies.push(company);
    } else {
      journeyMap.set(processStep, {
        id: processStep,
        name: processStep,
        companies: [company],
      });
    }
  }

  return Array.from(journeyMap.values());
}
