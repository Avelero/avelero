"use client";

/**
 * Certification overview modal content.
 */

import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/ssr/DownloadSimple";
import type { CustomFont } from "../../../types/passport";
import {
  ModalBody,
  ModalContent,
  ModalDataTable,
  ModalDescription,
  ModalFooter,
  ModalFooterButton,
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

interface CertificationModalProps {
  certificateUrl?: string;
  contentProps?: Omit<
    React.ComponentPropsWithoutRef<typeof ModalContent>,
    "children" | "styles"
  >;
  customFonts?: CustomFont[];
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

function getDefaultCertificationFacts(
  styles: ModalStyles,
  customFonts?: CustomFont[],
): ModalDataTableRow[] {
  // Seed the certification preview with a styled institute link row.
  return [
    {
      key: "Institute",
      label: "Institute",
      value: "Textile Certification Council",
    },
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
    { key: "Contact", label: "Contact", value: "compliance@example.com" },
  ];
}

export function CertificationModal({
  certificateUrl,
  contentProps,
  customFonts,
  description = "This certification is recorded as part of the material traceability information for this product passport.",
  facts,
  footerLinkProps,
  mapQuery,
  mapProps,
  select,
  styles,
  subtitle = "Certification overview",
  title = "Global Organic Textile Standard",
}: CertificationModalProps) {
  // Render the certification modal and opt the footer CTA into the shared interactive hover treatment.
  const resolvedFacts =
    facts ?? getDefaultCertificationFacts(styles, customFonts);

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
          <ModalFooterButton
            customFonts={customFonts}
            download
            href={certificateUrl}
            rel="noopener noreferrer"
            select={select}
            styles={styles}
            target="_blank"
            {...footerLinkProps}
          >
            <DownloadSimpleIcon aria-hidden className="h-4 w-4 shrink-0" />
            Download certificate
          </ModalFooterButton>
        </ModalFooter>
      )}
    </ModalContent>
  );
}
