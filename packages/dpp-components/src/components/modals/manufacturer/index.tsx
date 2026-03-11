"use client";

/**
 * Manufacturer overview modal content.
 */

import {
  ModalBody,
  ModalContent,
  ModalDataTable,
  ModalDescription,
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
  description?: string;
  facts?: ModalDataTableRow[];
  mapQuery?: string | null;
  select?: ModalSelectionGetter;
  styles: ModalStyles;
  subtitle?: string;
  title?: string;
}

const DEFAULT_MANUFACTURER_FACTS: ModalDataTableRow[] = [
  {
    key: "Address",
    label: "Address",
    value: "Strawinskylaan 3051\n1077 ZX Amsterdam\nNetherlands",
  },
  {
    key: "Website",
    label: "Website",
    value: (
      <a
        className="underline underline-offset-4"
        href="https://example.com"
        rel="noopener noreferrer"
        target="_blank"
      >
        example.com
      </a>
    ),
  },
  { key: "Contact", label: "Contact", value: "hello@example.com" },
];

export function ManufacturerModal({
  description = "This manufacturer is listed as the responsible producer for this product passport.",
  facts = DEFAULT_MANUFACTURER_FACTS,
  mapQuery,
  select,
  styles,
  subtitle = "Manufacturer overview",
  title = "Atelier Nord",
}: ManufacturerModalProps) {
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
            rows={facts}
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
