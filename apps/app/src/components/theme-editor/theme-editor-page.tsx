"use client";

import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { DesignEditorProvider } from "@/contexts/design-editor-provider";
import { useThemeQuery } from "@/hooks/use-theme";
import { useUserQuery } from "@/hooks/use-user";
import { DEMO_DPP_DATA } from "@/lib/demo-data";
import type { DppData, ThemeConfig, ThemeStyles } from "@v1/dpp-components";
import { DesignPreview } from "./design-preview";
import { DesignPanel } from "./panel";

interface ThemeEditorPageProps {
  initialThemeConfig?: ThemeConfig;
  initialThemeStyles?: ThemeStyles;
  initialGoogleFontsUrl?: string | null;
  previewData?: DppData;
}

/**
 * Client component that loads theme data and renders the theme editor.
 * Can optionally receive initial data for SSR, otherwise uses Suspense query.
 */
export function ThemeEditorPage({
  initialThemeConfig,
  initialThemeStyles,
  initialGoogleFontsUrl,
  previewData,
}: ThemeEditorPageProps = {}) {
  const { data: user } = useUserQuery();
  const { data: theme } = useThemeQuery();
  const brandId = user?.brand_id ?? undefined;

  // Use provided props or fall back to query data
  const themeConfig = initialThemeConfig ?? theme.themeConfig;
  const themeStyles = initialThemeStyles ?? theme.themeStyles;
  const googleFontsUrl = initialGoogleFontsUrl ?? theme.googleFontsUrl;
  const data = previewData ?? DEMO_DPP_DATA;

  return (
    <DesignEditorProvider
      initialThemeConfig={themeConfig}
      initialThemeStyles={themeStyles}
      initialGoogleFontsUrl={googleFontsUrl}
      previewData={data}
      brandId={brandId}
    >
      <div className="relative h-full">
        <Header variant="editor" />
        <div className="flex flex-row justify-start h-[calc(100%_-_56px)]">
          <Sidebar variant="editor" />
          <div className="relative w-[calc(100%_-_56px)] h-full ml-[56px]">
            <div className="flex h-full w-full">
              <DesignPanel />
              <div className="flex h-full min-h-full flex-1 flex-col">
                <DesignPreview />
              </div>
            </div>
          </div>
        </div>
      </div>
    </DesignEditorProvider>
  );
}
