"use client";

/**
 * Mock certification overview modal content.
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

interface CertificationModalFact {
  label: string;
  value: React.ReactNode;
}

interface CertificationModalProps {
  description?: string;
  facts?: CertificationModalFact[];
  select?: DppModalSelectionGetter;
  styles: DppModalStyles;
  subtitle?: string;
  title?: string;
}

const DEFAULT_CERTIFICATION_FACTS: CertificationModalFact[] = [
  { label: "Institute", value: "Textile Certification Council" },
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
  { label: "Contact", value: "compliance@example.com" },
  { label: "Document", value: "Download PDF" },
];

export function CertificationModal({
  description = "This mock modal shows the kind of certification overview we can render for a material or product-level certificate.",
  facts = DEFAULT_CERTIFICATION_FACTS,
  select,
  styles,
  subtitle = "Certification overview",
  title = "Global Organic Textile Standard",
}: CertificationModalProps) {
  // Render a mock certification fact sheet using the shared modal building blocks.
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
