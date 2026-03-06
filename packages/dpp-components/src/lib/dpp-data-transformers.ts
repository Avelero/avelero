/**
 * Pure data transformation functions extracted from InformationFrame.
 *
 * These transform DppData into display models consumed by the UI components
 * (ImpactFrame, MaterialsFrame, JourneyFrame).
 */

import { countries } from "@v1/selections";
import type { ImpactMetricDisplay } from "../components/impact/large-impact-card";
import type { DppData } from "../types/dpp-data";

/** Get country name from ISO code, falling back to the code itself */
export function getCountryName(code: string | undefined): string {
  if (!code) return "";
  const country = countries[code.toUpperCase() as keyof typeof countries];
  return country?.name ?? code;
}

/** Build impact metrics array from environmental data */
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

export interface MaterialDisplayData {
  percentage: number;
  type: string;
  origin: string;
  certification?: string;
  certificationUrl?: string;
}

/** Transform materials composition for display */
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

export interface JourneyStageData {
  id: string;
  name: string;
  companies: Array<{ name: string; location: string }>;
}

/** Transform supply chain into journey stages, grouped by process step */
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
