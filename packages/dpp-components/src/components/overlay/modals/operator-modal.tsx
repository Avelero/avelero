"use client";

/**
 * Mock operator overview modal content.
 */

import {
  DppModalContent,
  DppModalDescription,
  DppModalField,
  DppModalSection,
  DppModalSubtitle,
  DppModalTitle,
  getModalSelectionProps,
} from "./modal-building-blocks";
import type {
  DppModalSelectionGetter,
  DppModalStyles,
} from "./modal-building-blocks";

interface OperatorModalFact {
  label: string;
  value: React.ReactNode;
}

interface OperatorModalProps {
  description?: string;
  facts?: OperatorModalFact[];
  select?: DppModalSelectionGetter;
  styles: DppModalStyles;
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
  description = "This mock modal shows how operator facts can be rendered as a quick, scannable form-style overview.",
  facts = DEFAULT_OPERATOR_FACTS,
  select,
  styles,
  subtitle = "Supply chain operator",
  title = "Northern Atelier",
}: OperatorModalProps) {
  // Render a mock operator profile using the shared modal title, description, label, and value slots.
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
        {facts.map((fact) => (
          <DppModalField
            key={fact.label}
            label={fact.label}
            labelProps={getModalSelectionProps(select, "modal.label")}
            styles={styles}
            value={fact.value}
            valueProps={getModalSelectionProps(select, "modal.value")}
          />
        ))}
      </DppModalSection>
    </DppModalContent>
  );
}
