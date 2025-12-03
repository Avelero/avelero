"use client";

import { useThemeQuery } from "@/hooks/use-theme";
import { DEMO_DPP_DATA } from "@/lib/demo-data";
import { DesignPageClient } from "./design-page-client";

/**
 * Client component that loads theme data and renders the design editor.
 * Uses Suspense query to fetch theme data from the API.
 */
export function ThemeEditorLoader() {
  const { data: theme } = useThemeQuery();

  return (
    <DesignPageClient
      initialThemeConfig={theme.themeConfig}
      initialThemeStyles={theme.themeStyles}
      previewData={DEMO_DPP_DATA}
    />
  );
}
