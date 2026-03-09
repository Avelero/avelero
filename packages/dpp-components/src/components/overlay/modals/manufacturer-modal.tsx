"use client";

/**
 * Manufacturer overview modal content.
 */

import { LabeledDataTable } from "../../labeled-data-table";
import {
  DppModalContent,
  DppModalDescription,
  DppModalSection,
  DppModalSubtitle,
  DppModalTitle,
  getModalSelectionProps,
} from "./modal-building-blocks";
import type {
  DppModalSelectionGetter,
  DppModalStyles,
} from "./modal-building-blocks";

interface ManufacturerModalFact {
  label: string;
  value: React.ReactNode;
}

interface ManufacturerModalProps {
  description?: string;
  facts?: ManufacturerModalFact[];
  select?: DppModalSelectionGetter;
  styles: DppModalStyles;
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
  const borderColor =
    styles.row?.borderColor ??
    styles.header?.borderColor ??
    styles.container?.borderColor;
  const rows = facts.map((fact) => ({
    key: fact.label,
    label: fact.label,
    labelProps: getModalSelectionProps(select, "modal.label"),
    value: fact.value,
    valueProps: getModalSelectionProps(select, "modal.value"),
  }));

  return (
    <DppModalContent styles={styles}>
      <DppModalSection>
        <DppModalSubtitle
          {...getModalSelectionProps(select, "modal.subtitle")}
          styles={styles}
        >
          {subtitle}
        </DppModalSubtitle>
        <DppModalTitle
          {...getModalSelectionProps(select, "modal.title")}
          styles={styles}
        >
          {title}
        </DppModalTitle>
      </DppModalSection>

      <DppModalDescription
        {...getModalSelectionProps(select, "modal.description")}
        styles={styles}
      >
        {description}
      </DppModalDescription>

      <DppModalSection>
        <LabeledDataTable
          borderColor={borderColor}
          labelStyle={styles.label}
          rows={rows}
          valueClassName="whitespace-pre-line"
          valueStyle={styles.value}
        />
      </DppModalSection>
    </DppModalContent>
  );
}
