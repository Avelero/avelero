"use client";

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ThemeConfig, ThemeStyles } from "@v1/dpp-components";

/**
 * Return type for the theme query.
 */
export interface BrandTheme {
  themeStyles: ThemeStyles;
  themeConfig: ThemeConfig;
  updatedAt: string | null;
}

/**
 * Fetches the current brand's theme using Suspense.
 *
 * Returns the theme styles and configuration for the active brand.
 * Falls back to empty objects if no theme exists.
 *
 * @returns Suspense query hook for brand theme
 *
 * @example
 * ```tsx
 * const { data: theme } = useThemeQuery();
 * const { themeStyles, themeConfig } = theme;
 * ```
 */
export function useThemeQuery() {
  const trpc = useTRPC();
  const query = useSuspenseQuery(trpc.workflow.getTheme.queryOptions());

  // Cast the JSONB data to proper types
  return {
    ...query,
    data: {
      themeStyles: (query.data.themeStyles ?? {}) as ThemeStyles,
      themeConfig: (query.data.themeConfig ?? {}) as ThemeConfig,
      updatedAt: query.data.updatedAt,
    } satisfies BrandTheme,
  };
}

/**
 * Returns the query options for theme data.
 * Use this for prefetching in server components.
 */
export function useThemeQueryOptions() {
  const trpc = useTRPC();
  return trpc.workflow.getTheme.queryOptions();
}
