"use client";

/**
 * Manufacturer overview modal content.
 */

import type { CustomFont } from "../../../types/passport";
import {
  ModalBody,
  ModalContent,
  ModalDataTable,
  ModalDescription,
  ModalLink,
  ModalSection,
  ModalStaticMap,
  ModalSubtitle,
  ModalTitle,
  getModalSelectionProps,
} from "../../modal";
import type {
  ModalDataTableRow,
  ModalSelectionGetter,
  ModalStyles,
} from "../../modal";

interface ManufacturerModalProps {
  customFonts?: CustomFont[];
  description?: string;
  facts?: ModalDataTableRow[];
  mapQuery?: string | null;
  select?: ModalSelectionGetter;
  styles: ModalStyles;
  subtitle?: string;
  title?: string;
}

function getDefaultManufacturerFacts(
  styles: ModalStyles,
  customFonts?: CustomFont[],
): ModalDataTableRow[] {
  // Seed the preview with a styled external link alongside plain fact rows.
  return [
    {
      key: "Address",
      label: "Address",
      value: "Strawinskylaan 3051\n1077 ZX Amsterdam\nNetherlands",
    },
    {
      key: "Website",
      label: "Website",
      value: (
        <ModalLink
          customFonts={customFonts}
          href="https://example.com"
          rel="noopener noreferrer"
          styles={styles}
          target="_blank"
        >
          example.com
        </ModalLink>
      ),
    },
    { key: "Contact", label: "Contact", value: "hello@example.com" },
  ];
}

export function ManufacturerModal({
  customFonts,
  description = "This manufacturer is listed as the responsible producer for this product passport.",
  facts,
  mapQuery,
  select,
  styles,
  subtitle = "Manufacturer overview",
  title = "Atelier Nord",
}: ManufacturerModalProps) {
  // Fall back to the seeded fact rows only when runtime data is unavailable.
  const resolvedFacts =
    facts ?? getDefaultManufacturerFacts(styles, customFonts);

  return (
    <ModalContent styles={styles}>
      <ModalBody>
        <ModalSection>
          <ModalSubtitle
            {...getModalSelectionProps(select, "modal.subtitle")}
            styles={styles}
          >
            {subtitle}
          </ModalSubtitle>
          <ModalTitle
            {...getModalSelectionProps(select, "modal.title")}
            styles={styles}
          >
            {title}
          </ModalTitle>
        </ModalSection>

        <ModalDescription
          {...getModalSelectionProps(select, "modal.description")}
          styles={styles}
        >
          {description}
        </ModalDescription>

        <ModalSection>
          <ModalDataTable
            rows={resolvedFacts}
            select={select}
            styles={styles}
            valueClassName="whitespace-pre-line"
          />
        </ModalSection>

        {mapQuery ? (
          <ModalSection>
            <ModalStaticMap
              alt={`${title} location map`}
              query={mapQuery}
              select={select}
              styles={styles}
            />
          </ModalSection>
        ) : null}
      </ModalBody>
    </ModalContent>
  );
}
