"use client";

/**
 * Mock certification overview modal content.
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

interface CertificationModalFact {
  label: string;
  value: React.ReactNode;
}

interface CertificationModalProps {
  description?: string;
  facts?: CertificationModalFact[];
  select?: ModalSelectionGetter;
  styles: ModalStyles;
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
  description = "This certification is recorded as part of the material traceability information for this product passport.",
  facts = DEFAULT_CERTIFICATION_FACTS,
  select,
  styles,
  subtitle = "Certification overview",
  title = "Global Organic Textile Standard",
}: CertificationModalProps) {
  // Render a mock certification fact sheet using the shared modal building blocks.
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
