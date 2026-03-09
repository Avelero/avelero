"use client";

/**
 * Manufacturer overview modal content.
 */

import { DataTable } from "../data-table";
import {
  ModalContent,
  ModalDescription,
  ModalSection,
  ModalSubtitle,
  ModalTitle,
  getModalSelectionProps,
} from "../modal";
import type { ModalSelectionGetter, ModalStyles } from "../modal";

interface ManufacturerModalFact {
  label: string;
  value: React.ReactNode;
}

interface ManufacturerModalProps {
  description?: string;
  facts?: ManufacturerModalFact[];
  select?: ModalSelectionGetter;
  styles: ModalStyles;
  subtitle?: string;
  title?: string;
}

const DEFAULT_MANUFACTURER_FACTS: ManufacturerModalFact[] = [
  {
    label: "Address",
    value: "Keizersgracht 100\n1015 CV Amsterdam\nNetherlands",
  },
  {
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
  { label: "Contact", value: "hello@example.com" },
];

export function ManufacturerModal({
  description = "This manufacturer is listed as the responsible producer for this product passport.",
  facts = DEFAULT_MANUFACTURER_FACTS,
  select,
  styles,
  subtitle = "Manufacturer overview",
  title = "Atelier Nord",
}: ManufacturerModalProps) {
  // Render a compact manufacturer profile using the shared modal building blocks.
  const borderColor = styles["modal.container"]?.borderColor;
  const rows = facts.map((fact) => ({
    key: fact.label,
    label: fact.label,
    labelProps: getModalSelectionProps(select, "modal.label"),
    value: fact.value,
    valueProps: getModalSelectionProps(select, "modal.value"),
  }));

  return (
    <ModalContent styles={styles}>
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
        <DataTable
          borderColor={borderColor}
          labelStyle={styles["modal.label"]}
          rows={rows}
          valueClassName="whitespace-pre-line"
          valueStyle={styles["modal.value"]}
        />
      </ModalSection>
    </ModalContent>
  );
}
