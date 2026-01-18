"use client";

import type { SelectOption } from "@/components/passports/filter-types";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import * as React from "react";

/**
 * Hook for loading filter options using proper tRPC queries.
 * This hook uses the standard tRPC query keys, allowing prefetching to work correctly.
 *
 * All data comes from composite.catalogContent which should be prefetched
 * on pages that use filters.
 */
export function useFilterOptions() {
  const trpc = useTRPC();

  // Fetch the main passport form references using proper tRPC query
  // All filter data (including tags) comes from this single composite query
  const { data: formData, isLoading } = useQuery(
    trpc.composite.catalogContent.queryOptions(),
  );

  // Transform and memoize all options
  const options = React.useMemo(() => {
    return {
      // From composite.catalogContent
      categories:
        formData?.categories?.map((c: { id: string; name: string }) => ({
          value: c.id,
          label: c.name,
        })) ?? [],

      materials:
        formData?.brandCatalog?.materials?.map(
          (m: { id: string; name: string }) => ({
            value: m.id,
            label: m.name,
          }),
        ) ?? [],

      certifications:
        formData?.brandCatalog?.certifications?.map(
          (c: { id: string; title: string }) => ({
            value: c.id,
            label: c.title,
          }),
        ) ?? [],

      facilities:
        formData?.brandCatalog?.operators?.map(
          (f: { id: string; display_name: string }) => ({
            value: f.id,
            label: f.display_name,
          }),
        ) ?? [],

      manufacturers:
        formData?.brandCatalog?.manufacturers?.map(
          (m: { id: string; name: string }) => ({
            value: m.id,
            label: m.name,
          }),
        ) ?? [],

      seasons:
        formData?.brandCatalog?.seasons?.map(
          (s: { id: string; name: string }) => ({
            value: s.id,
            label: s.name,
          }),
        ) ?? [],

      // Tags are included in brandCatalog from catalogContent
      tags:
        formData?.brandCatalog?.tags?.map((t) => ({
          value: t.id,
          label: t.name,
          hex: t.hex ?? undefined,
        })) ?? [],
    };
  }, [formData]);

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
      materials: options.materials,
      brandCertificationId: options.certifications,
      operatorId: options.facilities,
      manufacturerId: options.manufacturers,
      tagId: options.tags,
      season: options.seasons ?? [],
    };

    return fieldMap[fieldId] ?? [];
  }, [options, fieldId]);

  return {
    options: fieldOptions,
    isLoading,
  };
}
