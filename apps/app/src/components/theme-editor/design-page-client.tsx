"use client";

import type { DppData, ThemeConfig, ThemeStyles } from "@v1/dpp-components";
import { DesignEditorProvider } from "@/contexts/design-editor-provider";
import { DesignPanel } from "../theme-editor/panel";
import { DesignPreview } from "./design-preview";
import { useUserQuery } from "@/hooks/use-user";

interface Props {
  initialThemeConfig: ThemeConfig;
  initialThemeStyles: ThemeStyles;
  previewData: DppData;
}

export function DesignPageClient({
  initialThemeConfig,
  initialThemeStyles,
  previewData,
}: Props) {
  const { data: user } = useUserQuery();
  const brandId = user?.brand_id ?? undefined;

  return (
    <DesignEditorProvider
      initialThemeConfig={initialThemeConfig}
      initialThemeStyles={initialThemeStyles}
      previewData={previewData}
      brandId={brandId}
    >
      <div className="flex h-full w-full">
        <DesignPanel />
        <div className="flex h-full min-h-full flex-1 flex-col">
          <DesignPreview />
        </div>
      </div>
    </DesignEditorProvider>
  );
}
