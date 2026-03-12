"use client";

/**
 * Sidebar description section.
 *
 * Renders a labeled description preview clamped to three lines.
 */

import { useState } from "react";
import { DescriptionModal, Modal } from "../../components";
import { createSectionSelectionAttributes } from "../../lib/editor-selection";
import { useHapticTap } from "../../lib/haptics";
import { INTERACTIVE_HOVER_CLASS_NAME } from "../../lib/interactive-hover";
import { resolveStyles } from "../../lib/resolve-styles";
import { createUnderlinedActionStyle } from "../../lib/underlined-action";
import type { SectionProps } from "../registry";

const DESCRIPTION_PREVIEW_WORD_LIMIT = 30;

function truncateDescriptionPreview(text: string, wordLimit: number) {
  // Build a stable preview during render so server and client agree on whether the control should exist.
  const trimmedText = text.trim();
  const words = trimmedText.match(/\S+/g) ?? [];

  if (words.length <= wordLimit) {
    return {
      text: trimmedText,
      isTruncated: false,
    };
  }

  const previewTokens = trimmedText.match(/\S+|\s+/g) ?? [];
  let previewText = "";
  let visibleWordCount = 0;

  for (const token of previewTokens) {
    if (token.trim().length === 0) {
      if (visibleWordCount === 0 || visibleWordCount >= wordLimit) {
        continue;
      }

      previewText += token;
      continue;
    }

    if (visibleWordCount >= wordLimit) {
      break;
    }

    previewText += token;
    visibleWordCount += 1;
  }

  return {
    text: `${previewText.trimEnd()}…`,
    isTruncated: true,
  };
}

export function DescriptionSection({
  section,
  tokens,
  data,
  zoneId,
  wrapperClassName,
  modalStyles,
  forceModalType,
}: SectionProps) {
  // Resolve styles and build the stable preview shown in the collapsed sidebar card.
  const s = resolveStyles(section.styles, tokens);
  const isForceOpen = forceModalType === "description";
  const description = data.productAttributes.description?.trim() ?? "";
  const manufacturerName =
    data.manufacturing?.manufacturer?.name?.trim() ||
    data.productAttributes.brand?.trim() ||
    data.manufacturing?.manufacturer?.legalName?.trim() ||
    "";
  const productTitle = data.productIdentifiers.productName?.trim() ?? "";
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const hapticTap = useHapticTap();
  const preview = truncateDescriptionPreview(
    description,
    DESCRIPTION_PREVIEW_WORD_LIMIT,
  );
  const select = createSectionSelectionAttributes(section.id, zoneId);
  const rootSelection = select("description");
  const showMoreStyle = createUnderlinedActionStyle(s.showMore, {
    customFonts: tokens.fonts,
    defaultColor: tokens.colors.link,
  });

  if (!description) return null;

  return (
    <Modal
      open={isDialogOpen || isForceOpen}
      onOpenChange={setIsDialogOpen}
      modal={!isForceOpen}
    >
      <div
        {...rootSelection}
        className={["flex flex-col gap-xs w-full", wrapperClassName]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="w-full border-b pb-xs" style={s.header}>
          <h2 className="w-fit" style={s.heading}>
            Description
          </h2>
        </div>

        <div className="flex flex-col gap-xs">
          <p className="line-clamp-3 whitespace-pre-line" style={s.body}>
            {preview.text}
          </p>

          {preview.isTruncated ? (
            <button
              type="button"
              className={`w-fit appearance-none border-0 bg-transparent p-0 text-left ${INTERACTIVE_HOVER_CLASS_NAME}`}
              style={showMoreStyle}
              onClick={() => {
                hapticTap();
                setIsDialogOpen(true);
              }}
            >
              Show more
            </button>
          ) : null}
        </div>
      </div>

      <DescriptionModal
        description={description}
        manufacturerName={manufacturerName}
        productTitle={productTitle}
        styles={modalStyles ?? {}}
      />
    </Modal>
  );
}
