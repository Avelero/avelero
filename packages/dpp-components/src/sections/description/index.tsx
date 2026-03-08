"use client";

/**
 * Sidebar description section.
 *
 * Renders a labeled description preview clamped to three lines.
 */

import { useEffect, useRef, useState } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "../../components/overlay/responsive-dialog";
import { createSectionSelectionAttributes } from "../../lib/editor-selection";
import { resolveStyles } from "../../lib/resolve-styles";
import type { SectionProps } from "../registry";

export function DescriptionSection({
  section,
  tokens,
  data,
  zoneId,
  wrapperClassName,
}: SectionProps) {
  // Resolve styles and determine whether the description overflows the preview.
  const s = resolveStyles(section.styles, tokens);
  const description = data.productAttributes.description?.trim() ?? "";
  const manufacturerName =
    data.manufacturing?.manufacturer?.name?.trim() ||
    data.productAttributes.brand?.trim() ||
    data.manufacturing?.manufacturer?.legalName?.trim() ||
    "";
  const productTitle = data.productIdentifiers.productName?.trim() ?? "";
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const [showButton, setShowButton] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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

  useEffect(() => {
    // Measure the clamped paragraph after layout settles so the control only shows when needed.
    const updateShowButton = () => {
      const paragraph = descriptionRef.current;
      if (!paragraph) return;
      setShowButton(paragraph.scrollHeight > paragraph.clientHeight + 1);
    };

    updateShowButton();

    const resizeObserver = new ResizeObserver(() => updateShowButton());
    if (descriptionRef.current) {
      resizeObserver.observe(descriptionRef.current);
    }

    const handleFontsLoaded = () => updateShowButton();
    if (document.fonts) {
      document.fonts.addEventListener("loadingdone", handleFontsLoaded);
    }

    const timeoutId = window.setTimeout(updateShowButton, 100);
    window.addEventListener("resize", updateShowButton);

    return () => {
      resizeObserver.disconnect();
      if (document.fonts) {
        document.fonts.removeEventListener("loadingdone", handleFontsLoaded);
      }
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", updateShowButton);
    };
  }, [description, section.styles, tokens]);

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
            ref={descriptionRef}
            className="line-clamp-3 whitespace-pre-line"
            style={s.body}
          >
            {description}
          </p>

          {showButton ? (
            <button
              {...showMoreSelection}
              type="button"
              className="appearance-none border-0 bg-transparent p-0 w-fit text-left"
              style={s.showMore}
              onClick={() => setIsDialogOpen(true)}
            >
              Show more
            </button>
          ) : null}
        </div>
      </div>

      <ResponsiveDialogContent bodyClassName="gap-8">
        <ResponsiveDialogHeader className="gap-4">
          {manufacturerName ? (
            <p
              className="text-lg font-medium leading-7"
              style={{ color: "var(--muted-light-foreground, #62637A)" }}
            >
              {manufacturerName}
            </p>
          ) : null}

          {productTitle ? (
            <ResponsiveDialogTitle>{productTitle}</ResponsiveDialogTitle>
          ) : null}
        </ResponsiveDialogHeader>

        <ResponsiveDialogDescription
          asChild
          className="whitespace-pre-line"
          style={s.body}
        >
          <div>{description}</div>
        </ResponsiveDialogDescription>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
