"use client";

/**
 * Shared theme-editor modal preview.
 *
 * Renders the real certification modal with mock data so the shared modal
 * editor always previews the same production component.
 */

import {
  CertificationModal,
  Modal,
  buildCertificationModalDescription,
  buildCertificationModalFacts,
  buildCertificationModalMapQuery,
  createFixedSelectionAttributes,
  type DppData,
  type MaterialCertification,
  type Passport,
} from "@v1/dpp-components";

interface ThemeEditorModalPreviewProps {
  customFonts?: Passport["tokens"]["fonts"];
  data: DppData;
  modal: Passport["modal"];
  modalStyles: Record<string, React.CSSProperties>;
  portalContainer?: HTMLElement | null;
}

const DEFAULT_PREVIEW_CERTIFICATION: MaterialCertification = {
  code: "GRS-2024-12345",
  expiryDate: "2027-02-15",
  issueDate: "2024-02-15",
  type: "Global Recycled Standard",
  testingInstitute: {
    city: "Amsterdam",
    email: "compliance@textilecouncil.example",
    legalName: "Textile Certification Council",
    website: "https://certifications.example.com/grs",
  },
};

export function ThemeEditorModalPreview({
  customFonts,
  data,
  modal,
  modalStyles,
  portalContainer,
}: ThemeEditorModalPreviewProps) {
  // Mount the real certification modal inside a non-modal dialog so the editor sidebar remains interactive.
  const certifiedMaterial = data.materials?.composition.find(
    (material) => material.certification,
  );
  const certification =
    certifiedMaterial?.certification ?? DEFAULT_PREVIEW_CERTIFICATION;
  const rootSelection = createFixedSelectionAttributes()("modal");

  return (
    <Modal open modal={false} onOpenChange={() => {}}>
      <CertificationModal
        certificateUrl="#theme-editor-modal-preview"
        contentProps={{
          ...rootSelection,
          disableCloseButtonInteraction: true,
          onEscapeKeyDown: (event) => event.preventDefault(),
          onFocusOutside: (event) => event.preventDefault(),
          onInteractOutside: (event) => event.preventDefault(),
          onPointerDownOutside: (event) => event.preventDefault(),
          portalContainer,
        }}
        description={buildCertificationModalDescription(
          certifiedMaterial?.material ?? "recycled polyester",
        )}
        customFonts={customFonts}
        facts={buildCertificationModalFacts(
          certification,
          modalStyles,
          customFonts,
          {
            onClick: (event) => event.preventDefault(),
          },
        )}
        footerLinkProps={{
          onClick: (event) => event.preventDefault(),
        }}
        mapProps={{
          onClick: (event) => event.preventDefault(),
        }}
        mapQuery={buildCertificationModalMapQuery(
          certification,
          modal.content.showExactLocation !== false,
        )}
        styles={modalStyles}
        subtitle="Certification overview"
        title={certification.type}
      />
    </Modal>
  );
}
