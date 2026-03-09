"use client";

/**
 * Mock operator overview modal content.
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
} from "../modal";
import type {
  ModalDataTableRow,
  ModalSelectionGetter,
  ModalStyles,
} from "../modal";

interface OperatorModalProps {
  description?: string;
  facts?: ModalDataTableRow[];
  mapQuery?: string | null;
  select?: ModalSelectionGetter;
  styles: ModalStyles;
  subtitle?: string;
  title?: string;
}

const DEFAULT_OPERATOR_FACTS: ModalDataTableRow[] = [
  { key: "Location", label: "Location", value: "Porto, Portugal" },
  { key: "Role", label: "Role", value: "Cut and sew facility" },
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
  { key: "Contact", label: "Contact", value: "operations@example.com" },
];

export function OperatorModal({
  description = "This operator is responsible for one of the production steps recorded in the product journey.",
  facts = DEFAULT_OPERATOR_FACTS,
  mapQuery,
  select,
  styles,
  subtitle = "Supply chain operator",
  title = "Northern Atelier",
}: OperatorModalProps) {
  // Render a mock operator profile using the shared modal title, description, label, and value slots.
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
          <ModalDataTable rows={facts} select={select} styles={styles} />
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
