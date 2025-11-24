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
    trpc.composite.brandCatalogContent.queryOptions(),
  );

  // Fetch additional endpoints that aren't in the composite
  const { data: tagsData, isLoading: isTagsLoading } = useQuery(
    trpc.brand.tags.list.queryOptions(undefined),
  );

  const { data: templatesData, isLoading: isTemplatesLoading } = useQuery(
    trpc.templates.list.queryOptions(undefined),
  );

  // Transform and memoize all options
  const options = React.useMemo(() => {
    return {
      // From composite.brandCatalogContent
      categories:
        formData?.categories?.map((c: { id: string; name: string }) => ({
          value: c.id,
          label: c.name,
        })) ?? [],

      colors:
        formData?.brandCatalog?.colors?.map(
          (c: { id: string; name: string }) => ({
            value: c.id,
            label: c.name,
          }),
        ) ?? [],

      sizes:
        formData?.brandCatalog?.sizes?.map(
          (s: { id: string; name: string }) => ({
            value: s.id,
            label: s.name,
          }),
        ) ?? [],

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
        formData?.brandCatalog?.operators?.map((f: { id: string; display_name: string }) => ({
          value: f.id,
          label: f.display_name,
        })) ?? [],
      
      operators:
        formData?.brandCatalog?.showcaseBrands?.map((b: { id: string; name: string }) => ({
          value: b.id,
          label: b.name,
        })) ?? [],

      seasons:
        formData?.brandCatalog?.seasons?.map((s: { id: string; name: string }) => ({
          value: s.id,
          label: s.name,
        })) ?? [],

      // From composite.brandCatalogContent
      ecoClaims:
        formData?.brandCatalog?.ecoClaims?.map((c: { id: string; claim: string }) => ({
          value: c.id,
          label: c.claim,
        })) ?? [],

      tags:
        tagsData?.data?.map((t: { id: string; name: string }) => ({
          value: t.id,
          label: t.name,
        })) ?? [],

      templates:
        (templatesData as any)?.data?.map(
          (t: { id: string; name: string }) => ({
            value: t.id,
            label: t.name,
          }),
        ) ?? [],
    };
  }, [formData, tagsData, templatesData]);

  const isLoading =
    isFormDataLoading || isTagsLoading || isTemplatesLoading;

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
      brandCertificationId: options.certifications,
      operatorId: options.facilities,
      showcaseBrandId: options.operators,
      ecoClaimId: options.ecoClaims,
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
