"use client";

/**
 * Certification overview modal content.
 */

import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/ssr/DownloadSimple";
import {
  ModalBody,
  ModalContent,
  ModalDataTable,
  ModalDescription,
  ModalFooter,
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

interface CertificationModalProps {
  certificateUrl?: string;
  description?: string;
  facts?: ModalDataTableRow[];
  mapQuery?: string | null;
  select?: ModalSelectionGetter;
  styles: ModalStyles;
  subtitle?: string;
  title?: string;
}

const DEFAULT_CERTIFICATION_FACTS: ModalDataTableRow[] = [
  {
    key: "Institute",
    label: "Institute",
    value: "Textile Certification Council",
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
  { key: "Contact", label: "Contact", value: "compliance@example.com" },
];

export function CertificationModal({
  certificateUrl,
  description = "This certification is recorded as part of the material traceability information for this product passport.",
  facts = DEFAULT_CERTIFICATION_FACTS,
  mapQuery,
  select,
  styles,
  subtitle = "Certification overview",
  title = "Global Organic Textile Standard",
}: CertificationModalProps) {
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

      {certificateUrl && (
        <ModalFooter styles={styles}>
          <a
            className="inline-flex w-full items-center justify-center gap-2 rounded-full text-base leading-6"
            download
            href={certificateUrl}
            rel="noopener noreferrer"
            style={{
              backgroundColor: "var(--background, #FFFFFF)",
              borderColor: "var(--border, #E0E0E0)",
              borderStyle: "solid",
              borderWidth: 1,
              color: "var(--foreground, #1E2040)",
              padding: 16,
            }}
            target="_blank"
          >
            <DownloadSimpleIcon aria-hidden className="h-4 w-4 shrink-0" />
            Download certificate
          </a>
        </ModalFooter>
      )}
    </ModalContent>
  );
}
