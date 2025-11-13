"use client";

import type { SelectOption } from "@/components/passports/filter-types";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import * as React from "react";

/**
 * Hook for loading filter options using proper tRPC queries.
 * This hook uses the standard tRPC query keys, allowing prefetching to work correctly.
 */
export function useFilterOptions() {
  const trpc = useTRPC();

  // Fetch the main passport form references using proper tRPC query
  const { data: formData, isLoading: isFormDataLoading } = useQuery(
    trpc.composite.passportFormReferences.queryOptions()
  );

  // Fetch additional endpoints that aren't in the composite
  const { data: ecoClaimsData, isLoading: isEcoClaimsLoading } = useQuery(
    trpc.brand.ecoClaims.list.queryOptions(undefined)
  );

  const { data: templatesData, isLoading: isTemplatesLoading } = useQuery(
    trpc.passports.templates.list.queryOptions(undefined)
  );

  // Transform and memoize all options
  const options = React.useMemo(() => {
    return {
      // From composite.passportFormReferences
      categories:
        formData?.categories?.map((c: { id: string; name: string }) => ({
          value: c.id,
          label: c.name,
        })) ?? [],

      colors:
        formData?.brandCatalog?.colors?.map((c: { id: string; name: string }) => ({
          value: c.id,
          label: c.name,
        })) ?? [],

      sizes:
        formData?.brandCatalog?.sizes?.map((s: { id: string; name: string }) => ({
          value: s.id,
          label: s.name,
        })) ?? [],

      materials:
        formData?.brandCatalog?.materials?.map((m: { id: string; name: string }) => ({
          value: m.id,
          label: m.name,
        })) ?? [],

      certifications:
        formData?.brandCatalog?.certifications?.map((c: { id: string; title: string }) => ({
          value: c.id,
          label: c.title,
        })) ?? [],

      facilities:
        formData?.brandCatalog?.facilities?.map((f: { id: string; display_name: string }) => ({
          value: f.id,
          label: f.display_name,
        })) ?? [],

      operators:
        formData?.brandCatalog?.operators?.map((b: { id: string; name: string }) => ({
          value: b.id,
          label: b.name,
        })) ?? [],

      // From separate endpoints
      ecoClaims:
        ecoClaimsData?.data?.map((c: { id: string; title: string }) => ({
          value: c.id,
          label: c.title,
        })) ?? [],

      templates:
        templatesData?.data?.map((t: { id: string; name: string }) => ({
          value: t.id,
          label: t.name,
        })) ?? [],
    };
  }, [formData, ecoClaimsData, templatesData]);

  const isLoading = isFormDataLoading || isEcoClaimsLoading || isTemplatesLoading;

  return {
    options,
    isLoading,
  };
}

/**
 * Get options for a specific field by its ID
 */
export function useFieldOptions(fieldId: string): {
  options: SelectOption[];
  isLoading: boolean;
} {
  const { options, isLoading } = useFilterOptions();

  const fieldOptions = React.useMemo(() => {
    // Map field IDs to their corresponding options
    const fieldMap: Record<string, SelectOption[]> = {
      categoryId: options.categories,
      colorId: options.colors,
      sizeId: options.sizes,
      materials: options.materials,
      certificationId: options.certifications,
      facilityId: options.facilities,
      showcaseBrandId: options.operators,
      ecoClaimId: options.ecoClaims,
      templateId: options.templates,
    };

    return fieldMap[fieldId] ?? [];
  }, [options, fieldId]);

  return {
    options: fieldOptions,
    isLoading,
  };
}
