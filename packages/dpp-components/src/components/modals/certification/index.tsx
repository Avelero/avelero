"use client";

/**
 * Certification overview modal content.
 */

import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/ssr/DownloadSimple";
import {
  INTERACTIVE_HOVER_CLASS_NAME,
  createInteractiveHoverStyle,
} from "../../../lib/interactive-hover";
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
} from "../../modal";
import type {
  ModalDataTableRow,
  ModalSelectionGetter,
  ModalStyles,
} from "../../modal";

interface CertificationModalProps {
  certificateUrl?: string;
  contentProps?: Omit<
    React.ComponentPropsWithoutRef<typeof ModalContent>,
    "children" | "styles"
  >;
  description?: string;
  facts?: ModalDataTableRow[];
  footerLinkProps?: Omit<
    React.ComponentPropsWithoutRef<"a">,
    "children" | "className" | "download" | "href" | "rel" | "style" | "target"
  >;
  mapQuery?: string | null;
  mapProps?: Omit<
    React.ComponentPropsWithoutRef<typeof ModalStaticMap>,
    "alt" | "query" | "select" | "styles"
  >;
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

function getCertificateDownloadButtonStyle(styles: ModalStyles) {
  // Invert the modal foreground/background pair so the CTA defaults to a solid high-contrast fill.
  return createInteractiveHoverStyle(
    {
      backgroundColor:
        typeof styles["modal.value"]?.color === "string"
          ? styles["modal.value"].color
          : "#1E2040",
      color:
        typeof styles["modal.container"]?.backgroundColor === "string"
          ? styles["modal.container"].backgroundColor
          : "#FFFFFF",
      padding: 16,
    },
    {
      background: true,
    },
  );
}

export function CertificationModal({
  certificateUrl,
  contentProps,
  description = "This certification is recorded as part of the material traceability information for this product passport.",
  facts = DEFAULT_CERTIFICATION_FACTS,
  footerLinkProps,
  mapQuery,
  mapProps,
  select,
  styles,
  subtitle = "Certification overview",
  title = "Global Organic Textile Standard",
}: CertificationModalProps) {
  // Render the certification modal and opt the footer CTA into the shared interactive hover treatment.
  const certificateDownloadButtonStyle =
    getCertificateDownloadButtonStyle(styles);

  return (
    <ModalContent styles={styles} {...contentProps}>
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
              {...mapProps}
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
            className={`inline-flex w-full items-center justify-center gap-2 rounded-full text-base leading-6 ${INTERACTIVE_HOVER_CLASS_NAME}`}
            download
            href={certificateUrl}
            rel="noopener noreferrer"
            style={certificateDownloadButtonStyle}
            target="_blank"
            {...footerLinkProps}
          >
            <DownloadSimpleIcon aria-hidden className="h-4 w-4 shrink-0" />
            Download certificate
          </a>
        </ModalFooter>
      )}
    </ModalContent>
  );
}
