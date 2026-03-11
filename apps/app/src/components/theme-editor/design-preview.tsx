"use client";

import { useDesignEditor } from "@/contexts/design-editor-provider";
import { useSelectableDetection } from "@/hooks/use-selectable-detection";
import { resolvePassportImageUrls } from "@/utils/storage-urls";
import { ContentFrame, Footer, Header } from "@v1/dpp-components";
import type { Passport } from "@v1/dpp-components";
import { useCallback, useMemo, useRef } from "react";
import { PreviewThemeInjector } from "./preview-theme-injector";
import { SaveBar } from "./save-bar";

export function DesignPreview() {
  const { previewData, passportDraft, previewModalType } = useDesignEditor();
  const containerRef = useRef<HTMLDivElement>(null);
  const brandName = previewData.productAttributes.brand;

  // Resolve storage paths to full URLs for preview display
  const resolvedPassport = useMemo(
    () => resolvePassportImageUrls(passportDraft),
    [passportDraft],
  );

  const { handleMouseMove, handleMouseLeave, handleClick } =
    useSelectableDetection(containerRef);

  // Guard only click capture when a modal is previewed so modal buttons
  // (close, tabs, links) still work.  Mouse-move detection stays active so
  // the user can hover-highlight selectable elements on the modal itself.
  // Elements beneath the overlay are unreachable because the overlay div
  // has pointer-events and sits between them and the cursor.
  const guardedClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!previewModalType) handleClick(e);
    },
    [previewModalType, handleClick],
  );

  return (
    <div className="relative w-full h-full bg-accent p-3 flex flex-col gap-3 items-center">
      <div
        ref={containerRef}
        className={`relative w-full h-full bg-white border border-border scrollbar-hide cursor-default [&_*]:!cursor-default [transform:translateZ(0)] ${previewModalType ? "overflow-hidden" : "overflow-auto"}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClickCapture={guardedClick}
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
            forceModalType={previewModalType}
          />
          <Footer
            footer={resolvedPassport.footer}
            tokens={resolvedPassport.tokens}
            brandName={brandName}
          />
          {/* Backdrop overlay when previewing a modal — pointer-events block
              interaction with elements beneath while modal content (z-91)
              remains interactive above this layer (z-90). */}
          {previewModalType && (
            <div
              className="fixed inset-0 z-[90]"
              style={{ background: "rgba(0, 0, 0, 0.247)" }}
            />
          )}
        </div>
      </div>
      <SaveBar />
    </div>
  );
}
