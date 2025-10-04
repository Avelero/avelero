"use client";

import * as React from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import type { SelectOption } from "@/components/passports/filter-types";

/**
 * Hook for loading dynamic field options from tRPC endpoints
 * 
 * Handles loading, caching, and transformation of options for filter fields
 * that fetch their data from the backend (colors, sizes, materials, etc.)
 * 
 * @param endpoint - tRPC endpoint path (e.g., "brandCatalog.colors.list")
 * @param transform - Optional transform function to convert data to SelectOption[]
 * @returns { options, isLoading, error }
 */
export function useFieldOptions(
  endpoint: string | undefined,
  transform?: (data: any) => SelectOption[]
) {
  const trpc = useTRPC();

  // Parse the endpoint path to access nested tRPC procedures
  const { data, isLoading, error } = useQuery({
    queryKey: ["fieldOptions", endpoint],
    queryFn: async () => {
      if (!endpoint) return null;

      // Parse endpoint like "brandCatalog.colors.list"
      const parts = endpoint.split(".");
      
      // Navigate to the correct tRPC procedure
      let procedure: any = trpc;
      for (const part of parts) {
        procedure = procedure[part];
        if (!procedure) {
          throw new Error(`Invalid tRPC endpoint: ${endpoint}`);
        }
      }

      // Execute the query
      const result = await procedure.query({});
      return result;
    },
    enabled: !!endpoint,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });

  // Transform the data to SelectOption[] format
  const options = React.useMemo<SelectOption[]>(() => {
    if (!data) return [];
    
    if (transform) {
      return transform(data);
    }

    // Default transformation: assume data.data is an array with id and name
    const items = (data as any)?.data ?? [];
    if (!Array.isArray(items)) return [];

    return items.map((item: any) => ({
      value: item.id ?? item.value ?? "",
      label: item.name ?? item.label ?? item.title ?? "",
    }));
  }, [data, transform]);

  return {
    options,
    isLoading,
    error: error as Error | null,
  };
}

/**
 * Hook for loading multiple field options in parallel
 * 
 * Useful when you need to load options for multiple fields at once
 * 
 * @param configs - Array of endpoint configurations
 * @returns Map of endpoint to options
 */
export function useMultipleFieldOptions(
  configs: Array<{
    endpoint: string;
    transform?: (data: any) => SelectOption[];
  }>
) {
  const results = configs.map(({ endpoint, transform }) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useFieldOptions(endpoint, transform)
  );

  const optionsMap = React.useMemo(() => {
    const map = new Map<string, SelectOption[]>();
    configs.forEach(({ endpoint }, index) => {
      map.set(endpoint, results[index]?.options ?? []);
    });
    return map;
  }, [configs, results]);

  const isLoading = results.some((r) => r.isLoading);
  const hasError = results.some((r) => r.error);

  return {
    optionsMap,
    isLoading,
    hasError,
  };
}

/**
 * Hook for pre-loading common filter options
 * 
 * Call this early in the component tree to warm up the cache
 * for frequently used filter options
 */
export function usePrefetchFilterOptions() {
  const trpc = useTRPC();

  React.useEffect(() => {
    // Prefetch common options that are likely to be used
    const prefetchEndpoints = [
      "brandCatalog.colors.list",
      "brandCatalog.sizes.list",
      "catalog.categories.list",
    ];

    for (const endpoint of prefetchEndpoints) {
      const parts = endpoint.split(".");
      let procedure: any = trpc;
      
      for (const part of parts) {
        procedure = procedure[part];
      }

      if (procedure?.query) {
        // Use queryClient to prefetch
        procedure.query({}).catch(() => {
          // Silently fail prefetch
        });
      }
    }
  }, [trpc]);
}

