/**
 * Custom hook for fetching all reference data needed for the passport form.
 *
 * Combines API data (brand-specific catalog items) with client-side selections
 * (system defaults for colors, sizes, seasons, categories, production steps).
 *
 * This hook orchestrates the data fetching for all dropdown fields in the
 * passport creation/edit form, ensuring a single source of truth.
 */

import { useTRPC } from "@/trpc/client";
import {
  categoryHierarchy,
  type CategoryNode,
  getAllCategories,
} from "@v1/selections/categories";
import { allColors } from "@v1/selections/colors";
import { allProductionSteps } from "@v1/selections/production-steps";
import { generateSeasonOptions } from "@v1/selections/seasons";
import { useQuery } from "@tanstack/react-query";

/**
 * Option format for select dropdowns.
 */
export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Color option with hex value for visual display.
 * Note: Uses 'name' instead of 'label' to match ColorSelect component interface.
 */
export interface ColorOption {
  name: string;
  hex: string;
}

/**
 * Size option with category association.
 */
export interface SizeOption extends SelectOption {
  categoryId: string;
  sortIndex?: number;
}

/**
 * Season option with date range information.
 */
export interface SeasonOption {
  name: string;
  startDate?: Date;
  endDate?: Date;
  isOngoing?: boolean;
}

/**
 * Material option with additional metadata.
 */
export interface MaterialOption extends SelectOption {
  countryOfOrigin?: string;
  recyclable?: boolean;
  certificationId?: string;
}

/**
 * Facility/Operator option with location data.
 */
export interface FacilityOption extends SelectOption {
  countryCode?: string;
  city?: string;
}

/**
 * Production step option for journey.
 */
export interface ProductionStepOption extends SelectOption {
  category: string;
}

/**
 * Complete form reference data structure.
 */
export interface PassportFormData {
  // System-level data (from selections package)
  categories: SelectOption[];
  seasons: SeasonOption[];
  productionSteps: ProductionStepOption[];
  
  // Brand catalog data (from API)
  materials: MaterialOption[];
  facilities: FacilityOption[];
  colors: ColorOption[];
  sizes: SizeOption[];
  certifications: SelectOption[];
  ecoClaims: SelectOption[];
  showcaseBrands: SelectOption[];
  
  // Combined data (API + defaults)
  allColors: ColorOption[];
  allSizes: SizeOption[];
}

/**
 * Fetches and merges all reference data needed for the passport form.
 *
 * System defaults (categories, seasons, production steps, base colors/sizes)
 * come from the @v1/selections package. Brand-specific catalog items come
 * from the API's composite endpoint.
 *
 * Colors and sizes are merged: the dropdown shows system defaults + any
 * custom colors/sizes the brand has already created.
 *
 * @returns Form reference data with loading and error states
 *
 * @example
 * ```tsx
 * function CreatePassportForm() {
 *   const { data, isLoading, error } = usePassportFormData();
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage />;
 *
 *   return <Form materials={data.materials} colors={data.allColors} />;
 * }
 * ```
 */
export function usePassportFormData() {
  const trpc = useTRPC();

  // Fetch brand catalog data from API
  const { data: apiData, isLoading, error } = useQuery(
    trpc.composite.passportFormReferences.queryOptions(),
  );

  // Generate system-level selections
  // Convert category hierarchy to flat list for dropdown (all tiers)
  const systemCategories: SelectOption[] = getAllCategories().map((cat) => ({
    value: cat.key,
    label: cat.displayName,
  }));

  const systemSeasons: SeasonOption[] = generateSeasonOptions(
    new Date().getFullYear(),
    3,
  ).map((opt) => ({
    name: opt.displayName,
    startDate: new Date(opt.year, (opt.season.startMonth || 1) - 1, 1),
    endDate: new Date(opt.year, (opt.season.endMonth || 12) - 1, 28),
    isOngoing: opt.season.isOngoing,
  }));

  const systemProductionSteps: ProductionStepOption[] = allProductionSteps.map(
    (step) => ({
      value: step.id,
      label: step.name,
      category: step.category,
    }),
  );

  // Default colors from selections package
  const defaultColors: ColorOption[] = allColors.map((color) => ({
    name: color.name,
    hex: color.hex,
  }));

  // Default sizes - will come from brand catalog
  // System doesn't have default sizes, only brand-created sizes
  const defaultSizes: SizeOption[] = [];

  // Transform API data if available
  const brandMaterials: MaterialOption[] =
    apiData?.brandCatalog.materials.map((m: any) => ({
      value: m.id,
      label: m.name,
      countryOfOrigin: m.country_of_origin,
      recyclable: m.recyclable,
      certificationId: m.certification_id,
    })) || [];

  const brandFacilities: FacilityOption[] =
    apiData?.brandCatalog.facilities.map((f: any) => ({
      value: f.id,
      label: f.name,
      countryCode: f.country_code,
      city: f.city,
    })) || [];

  const brandColors: ColorOption[] =
    apiData?.brandCatalog.colors.map((c: any) => ({
      name: c.name,
      hex: c.hex || "000000",
    })) || [];

  const brandSizes: SizeOption[] =
    apiData?.brandCatalog.sizes.map((s: any) => ({
      value: s.id,
      label: s.name,
      categoryId: s.category_id,
      sortIndex: s.sort_index,
    })) || [];

  const brandCertifications: SelectOption[] =
    apiData?.brandCatalog.certifications.map((cert: any) => ({
      value: cert.id,
      label: cert.title,
    })) || [];

  const brandEcoClaims: SelectOption[] =
    apiData?.brandCatalog.ecoClaims.map((claim: any) => ({
      value: claim.id,
      label: claim.text,
    })) || [];

  const showcaseBrands: SelectOption[] =
    apiData?.brandCatalog.operators.map((op: any) => ({
      value: op.id,
      label: op.name,
    })) || [];

  // Merge brand colors with default colors (dedupe by name, prefer brand version)
  const colorMap = new Map<string, ColorOption>();
  for (const color of defaultColors) {
    colorMap.set(color.name.toLowerCase(), color);
  }
  for (const color of brandColors) {
    colorMap.set(color.name.toLowerCase(), color);
  }
  const mergedColors = Array.from(colorMap.values());

  // Merge brand sizes with default sizes (dedupe by label + category, prefer brand version)
  const sizeMap = new Map<string, SizeOption>();
  for (const size of defaultSizes) {
    sizeMap.set(`${size.categoryId}-${size.label}`, size);
  }
  for (const size of brandSizes) {
    sizeMap.set(`${size.categoryId}-${size.label}`, size);
  }
  const mergedSizes = Array.from(sizeMap.values());

  const formData: PassportFormData = {
    categories: systemCategories,
    seasons: systemSeasons,
    productionSteps: systemProductionSteps,
    materials: brandMaterials,
    facilities: brandFacilities,
    colors: brandColors,
    sizes: brandSizes,
    certifications: brandCertifications,
    ecoClaims: brandEcoClaims,
    showcaseBrands,
    allColors: mergedColors,
    allSizes: mergedSizes,
  };

  return {
    data: formData,
    isLoading,
    error,
  };
}

