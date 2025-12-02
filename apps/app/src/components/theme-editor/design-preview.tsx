"use client";

import { useRef } from "react";
import { PreviewThemeInjector } from "./preview-theme-injector";
import { ContentFrame, Header, Footer } from "@v1/dpp-components";
import { useDesignEditor } from "@/contexts/design-editor-provider";
import { SaveBar } from "./save-bar";
import { useSelectableDetection } from "@/hooks/use-selectable-detection";

export function DesignPreview() {
  const { previewData, themeConfigDraft, themeStylesDraft } = useDesignEditor();
  const containerRef = useRef<HTMLDivElement>(null);

  const { handleMouseMove, handleMouseLeave, handleClick } =
    useSelectableDetection(containerRef);

  return (
    <div className="w-full h-full bg-accent p-3 flex flex-col gap-3 items-center">
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
            themeConfig={themeConfigDraft}
            brandName={previewData.brandName}
            position="sticky"
          />
          <ContentFrame data={previewData} themeConfig={themeConfigDraft} />
          <Footer themeConfig={themeConfigDraft} />
        </div>
      </div>
      <SaveBar />
    </div>
  );
}
