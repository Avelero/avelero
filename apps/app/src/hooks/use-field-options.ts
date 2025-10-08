"use client";

import type { SelectOption } from "@/components/passports/filter-types";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";

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
  transform?: (data: any) => SelectOption[],
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
