"use client";

/**
 * Mock operator overview modal content.
 */

import {
  ModalContent,
  ModalDescription,
  ModalField,
  ModalSection,
  ModalSubtitle,
  ModalTitle,
  getModalSelectionProps,
} from "../modal";
import type { ModalSelectionGetter, ModalStyles } from "../modal";

interface OperatorModalFact {
  label: string;
  value: React.ReactNode;
}

interface OperatorModalProps {
  description?: string;
  facts?: OperatorModalFact[];
  select?: ModalSelectionGetter;
  styles: ModalStyles;
  subtitle?: string;
  title?: string;
}

const DEFAULT_OPERATOR_FACTS: OperatorModalFact[] = [
  { label: "Location", value: "Porto, Portugal" },
  { label: "Role", value: "Cut and sew facility" },
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
  { label: "Contact", value: "operations@example.com" },
];

export function OperatorModal({
  description = "This operator is responsible for one of the production steps recorded in the product journey.",
  facts = DEFAULT_OPERATOR_FACTS,
  select,
  styles,
  subtitle = "Supply chain operator",
  title = "Northern Atelier",
}: OperatorModalProps) {
  // Render a mock operator profile using the shared modal title, description, label, and value slots.
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
        {facts.map((fact) => (
          <ModalField
            key={fact.label}
            label={fact.label}
            labelProps={getModalSelectionProps(select, "modal.label")}
            styles={styles}
            value={fact.value}
            valueProps={getModalSelectionProps(select, "modal.value")}
          />
        ))}
      </ModalSection>
    </ModalContent>
  );
}
