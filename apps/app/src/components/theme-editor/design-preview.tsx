"use client";

import { useDesignEditor } from "@/contexts/design-editor-provider";
import { useSelectableDetection } from "@/hooks/use-selectable-detection";
import { resolvePassportImageUrls } from "@/utils/storage-urls";
import { ContentFrame, Footer, Header } from "@v1/dpp-components";
import type { Passport } from "@v1/dpp-components";
import { useMemo, useRef } from "react";
import { PreviewThemeInjector } from "./preview-theme-injector";
import { SaveBar } from "./save-bar";

export function DesignPreview() {
  const { previewData, passportDraft } = useDesignEditor();
  const containerRef = useRef<HTMLDivElement>(null);
  const brandName = previewData.productAttributes.brand;

  // Resolve storage paths to full URLs for preview display
  const resolvedPassport = useMemo(
    () => resolvePassportImageUrls(passportDraft),
    [passportDraft],
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
        <PreviewThemeInjector tokens={passportDraft.tokens} />
        <div className="dpp-root min-h-full flex flex-col @container">
          <Header
            header={resolvedPassport.header}
            tokens={resolvedPassport.tokens}
            brandName={brandName}
            position="sticky"
          />
          <ContentFrame
            passport={resolvedPassport}
            data={previewData}
          />
          <Footer
            footer={resolvedPassport.footer}
            tokens={resolvedPassport.tokens}
            brandName={brandName}
          />
        </div>
      </div>
      <SaveBar />
    </div>
  );
}
