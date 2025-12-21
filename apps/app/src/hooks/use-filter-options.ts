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
    trpc.composite.catalogContent.queryOptions(),
  );

  // Fetch additional endpoints that aren't in the composite
  const { data: tagsData, isLoading: isTagsLoading } = useQuery(
    trpc.catalog.tags.list.queryOptions(undefined),
  );

  // Derive colors from brand attributes linked to "Color" taxonomy attribute
  const colorOptions = React.useMemo(() => {
    const taxAttrs = formData?.taxonomy?.attributes ?? [];
    const colorTaxAttr = taxAttrs.find((a: any) => a.friendlyId === "color");
    if (!colorTaxAttr) return [];

    const brandAttrs = formData?.brandCatalog?.attributes ?? [];
    const colorBrandAttr = brandAttrs.find((a: any) => a.taxonomyAttributeId === colorTaxAttr.id);
    if (!colorBrandAttr) return [];

    const values = (formData?.brandCatalog?.attributeValues ?? [])
      .filter((v: any) => v.attributeId === colorBrandAttr.id);
    
    return values.map((v: any) => ({ value: v.id, label: v.name }));
  }, [formData]);

  // Derive sizes from brand attributes linked to "Size" taxonomy attribute
  const sizeOptions = React.useMemo(() => {
    const taxAttrs = formData?.taxonomy?.attributes ?? [];
    const sizeTaxAttr = taxAttrs.find((a: any) => a.friendlyId === "size");
    if (!sizeTaxAttr) return [];

    const brandAttrs = formData?.brandCatalog?.attributes ?? [];
    const sizeBrandAttr = brandAttrs.find((a: any) => a.taxonomyAttributeId === sizeTaxAttr.id);
    if (!sizeBrandAttr) return [];

    const values = (formData?.brandCatalog?.attributeValues ?? [])
      .filter((v: any) => v.attributeId === sizeBrandAttr.id);
    
    return values.map((v: any) => ({ value: v.id, label: v.name }));
  }, [formData]);

  // Transform and memoize all options
  const options = React.useMemo(() => {
    return {
      // From composite.catalogContent
      categories:
        formData?.categories?.map((c: { id: string; name: string }) => ({
          value: c.id,
          label: c.name,
        })) ?? [],

      colors: colorOptions,

      sizes: sizeOptions,

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

      operators:
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

      // From composite.catalogContent
      ecoClaims:
        formData?.brandCatalog?.ecoClaims?.map(
          (c: { id: string; claim: string }) => ({
            value: c.id,
            label: c.claim,
          }),
        ) ?? [],

      tags:
        tagsData?.data?.map((t: { id: string; name: string }) => ({
          value: t.id,
          label: t.name,
        })) ?? [],

    };
  }, [formData, tagsData, colorOptions, sizeOptions]);

  const isLoading = isFormDataLoading || isTagsLoading;

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
      manufacturerId: options.operators,
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
