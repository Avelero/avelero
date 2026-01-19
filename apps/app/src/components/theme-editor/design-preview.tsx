"use client";

import { useDesignEditor } from "@/contexts/design-editor-provider";
import { useSelectableDetection } from "@/hooks/use-selectable-detection";
import { resolveThemeConfigImageUrls } from "@/utils/storage-urls";
import { ContentFrame, Footer, Header } from "@v1/dpp-components";
import { useMemo, useRef } from "react";
import { PreviewThemeInjector } from "./preview-theme-injector";
import { SaveBar } from "./save-bar";

export function DesignPreview() {
  const { previewData, themeConfigDraft, themeStylesDraft } = useDesignEditor();
  const containerRef = useRef<HTMLDivElement>(null);
  const brandName = previewData.productAttributes.brand;

  // Resolve storage paths to full URLs for preview display
  // The draft stores paths, but preview components expect full URLs
  const resolvedThemeConfig = useMemo(
    () => resolveThemeConfigImageUrls(themeConfigDraft),
    [themeConfigDraft],
  );

  const { handleMouseMove, handleMouseLeave, handleClick } =
    useSelectableDetection(containerRef);

  return (
    <div className="relative w-full h-full bg-accent p-3 flex flex-col gap-3 items-center">
      <div
        ref={containerRef}
        className="relative w-full h-full bg-white border border-border overflow-auto scrollbar-hide cursor-default [&_*]:!cursor-default"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClickCapture={handleClick}
      >
        <PreviewThemeInjector themeStyles={themeStylesDraft} />
        <div className="dpp-root min-h-full flex flex-col @container">
          <Header
            themeConfig={resolvedThemeConfig}
            brandName={brandName}
            position="sticky"
          />
          <ContentFrame data={previewData} themeConfig={resolvedThemeConfig} />
          <Footer themeConfig={resolvedThemeConfig} brandName={brandName} />
        </div>
      </div>
      <SaveBar />
    </div>
  );
}
