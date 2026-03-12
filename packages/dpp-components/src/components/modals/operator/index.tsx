"use client";

/**
 * Mock operator overview modal content.
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

interface OperatorModalProps {
  customFonts?: CustomFont[];
  description?: string;
  facts?: ModalDataTableRow[];
  mapQuery?: string | null;
  select?: ModalSelectionGetter;
  styles: ModalStyles;
  subtitle?: string;
  title?: string;
}

function getDefaultOperatorFacts(
  styles: ModalStyles,
  customFonts?: CustomFont[],
): ModalDataTableRow[] {
  // Seed the operator modal preview with a styled external-link row.
  return [
    { key: "Location", label: "Location", value: "Porto, Portugal" },
    { key: "Role", label: "Role", value: "Cut and sew facility" },
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
    { key: "Contact", label: "Contact", value: "operations@example.com" },
  ];
}

export function OperatorModal({
  customFonts,
  description = "This operator is responsible for one of the production steps recorded in the product journey.",
  facts,
  mapQuery,
  select,
  styles,
  subtitle = "Supply chain operator",
  title = "Northern Atelier",
}: OperatorModalProps) {
  // Render a mock operator profile using the shared modal title, description, label, and value slots.
  const resolvedFacts = facts ?? getDefaultOperatorFacts(styles, customFonts);

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
