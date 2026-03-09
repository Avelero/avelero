"use client";

/**
 * Sidebar description section.
 *
 * Renders a labeled description preview clamped to three lines.
 */

import { useState } from "react";
import { DescriptionModal, ResponsiveDialog } from "../../components";
import { createSectionSelectionAttributes } from "../../lib/editor-selection";
import {
  INTERACTIVE_HOVER_CLASS_NAME,
  createInteractiveHoverStyle,
} from "../../lib/interactive-hover";
import { resolveStyles } from "../../lib/resolve-styles";
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

function createDescriptionModalSelectionGetter(
  select: ReturnType<typeof createSectionSelectionAttributes>,
) {
  // Scope modal slot ids to the description section namespace for editor selection.
  return (slotId: string) => select(`description.${slotId}`);
}

export function DescriptionSection({
  section,
  tokens,
  data,
  zoneId,
  wrapperClassName,
}: SectionProps) {
  // Resolve styles and build the stable preview shown in the collapsed sidebar card.
  const s = resolveStyles(section.styles, tokens);
  const description = data.productAttributes.description?.trim() ?? "";
  const manufacturerName =
    data.manufacturing?.manufacturer?.name?.trim() ||
    data.productAttributes.brand?.trim() ||
    data.manufacturing?.manufacturer?.legalName?.trim() ||
    "";
  const productTitle = data.productIdentifiers.productName?.trim() ?? "";
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const preview = truncateDescriptionPreview(
    description,
    DESCRIPTION_PREVIEW_WORD_LIMIT,
  );
  const rootSelect = createSectionSelectionAttributes(
    section.id,
    zoneId,
    "section-root",
  );
  const select = createSectionSelectionAttributes(section.id, zoneId);
  const rootSelection = rootSelect("description");
  const headingSelection = select("description.heading");
  const bodySelection = select("description.body");
  const showMoreSelection = select("description.showMore");
  const showMoreStyle = createInteractiveHoverStyle(s.showMore, {
    color: true,
  });
  const modalSelect = createDescriptionModalSelectionGetter(select);

  if (!description) return null;

  return (
    <ResponsiveDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <div
        {...rootSelection}
        className={["flex flex-col gap-xs w-full", wrapperClassName]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="w-full border-b pb-xs" style={s.header}>
          <h2 {...headingSelection} className="w-fit" style={s.heading}>
            Description
          </h2>
        </div>

        <div className="flex flex-col gap-xs">
          <p
            {...bodySelection}
            className="line-clamp-3 whitespace-pre-line"
            style={s.body}
          >
            {preview.text}
          </p>

          {preview.isTruncated ? (
            <button
              {...showMoreSelection}
              type="button"
              className={`appearance-none border-0 bg-transparent p-0 w-fit text-left ${INTERACTIVE_HOVER_CLASS_NAME}`}
              style={showMoreStyle}
              onClick={() => setIsDialogOpen(true)}
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
        select={modalSelect}
        styles={s}
      />
    </ResponsiveDialog>
  );
}
