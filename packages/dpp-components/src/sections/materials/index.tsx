"use client";

/**
 * Materials sidebar section.
 *
 * Renders the transformed material composition as shadowed cards with badges and certification links.
 */

import { MapPinIcon } from "@phosphor-icons/react/dist/ssr/MapPin";
import { Icons } from "@v1/ui/icons";
import { Fragment, useState } from "react";
import { CertificationModal, Modal } from "../../components";
import { createSectionSelectionAttributes } from "../../lib/editor-selection";
import {
  INTERACTIVE_HOVER_CLASS_NAME,
  createInteractiveHoverStyle,
} from "../../lib/interactive-hover";
import { resolveStyles } from "../../lib/resolve-styles";
import { getResolvedTextLineHeight } from "../../lib/text-line-height";
import { toExternalHref } from "../../lib/url-utils";
import { getCountryName, transformMaterials } from "../_transforms";
import type { SectionProps } from "../registry";

function createMaterialsModalSelectionGetter(
  select: ReturnType<typeof createSectionSelectionAttributes>,
) {
  // Scope modal slot ids to the materials section namespace for editor selection.
  return (slotId: string) => select(`materials.${slotId}`);
}

function buildCertificationModalFacts(
  material: ReturnType<typeof transformMaterials>[number],
) {
  // Gather the available certification facts into label/value rows for the modal.
  const facts: Array<{ label: string; value: React.ReactNode }> = [];
  const certification = material.certification;
  const institute = certification?.testingInstitute;

  if (!certification) {
    return facts;
  }

  if (certification.code) {
    facts.push({
      label: "Certification code",
      value: certification.code,
    });
  }

  if (certification.issueDate) {
    facts.push({
      label: "Issue date",
      value: formatDateFactValue(certification.issueDate),
    });
  }

  if (certification.expiryDate) {
    facts.push({
      label: "Expiry date",
      value: formatDateFactValue(certification.expiryDate),
    });
  }

  if (institute?.legalName) {
    facts.push({ label: "Institute name", value: institute.legalName });
  }

  if (institute?.website) {
    const certificationHref = toExternalHref(institute.website);

    facts.push({
      label: "Institute website",
      value: certificationHref ? (
        <a
          className="underline underline-offset-4"
          href={certificationHref}
          rel="noopener noreferrer"
          target="_blank"
        >
          {institute.website}
        </a>
      ) : (
        institute.website
      ),
    });
  }

  if (institute?.email) {
    facts.push({ label: "Institute email", value: institute.email });
  }

  if (institute?.phone) {
    facts.push({ label: "Institute phone", value: institute.phone });
  }

  if (institute?.addressLine1) {
    facts.push({ label: "Address line 1", value: institute.addressLine1 });
  }

  if (institute?.addressLine2) {
    facts.push({ label: "Address line 2", value: institute.addressLine2 });
  }

  if (institute?.city) {
    facts.push({ label: "City", value: institute.city });
  }

  if (institute?.state) {
    facts.push({ label: "State", value: institute.state });
  }

  if (institute?.postalCode) {
    facts.push({ label: "Postal code", value: institute.postalCode });
  }

  if (institute?.country) {
    facts.push({
      label: "Country",
      value: getCountryName(institute.country) || institute.country,
    });
  }

  if (certification.documentUrl) {
    const documentHref = toExternalHref(certification.documentUrl);

    facts.push({
      label: "Certificate document",
      value: documentHref ? (
        <a
          className="underline underline-offset-4"
          href={documentHref}
          rel="noopener noreferrer"
          target="_blank"
        >
          Download certificate
        </a>
      ) : (
        certification.documentUrl
      ),
    });
  }

  return facts;
}

function formatDateFactValue(value: string) {
  // Collapse persisted timestamps to a stable calendar-date label in the modal.
  const isoDate = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  return isoDate ?? value;
}

export function MaterialsSection({
  section,
  tokens,
  data,
  zoneId,
  wrapperClassName,
}: SectionProps) {
  // Resolve styles and shape the materials data for the sidebar card.
  const s = resolveStyles(section.styles, tokens);
  const materials = transformMaterials(data);
  const [isCertificationDialogOpen, setIsCertificationDialogOpen] =
    useState(false);
  const [selectedCertification, setSelectedCertification] = useState<
    ReturnType<typeof transformMaterials>[number] | null
  >(null);
  const showCheckIcon = section.content.showCertificationCheckIcon !== false;
  const select = createSectionSelectionAttributes(section.id, zoneId);
  const titleSelection = select("materials.title");
  const cardSelection = select("materials.card");
  const percentageSelection = select("materials.card.percentage");
  const typeSelection = select("materials.card.type");
  const originSelection = select("materials.card.origin");
  const locationIconSelection = select("materials.card.locationIcon");
  const certificationSelection = select("materials.card.certification");
  const certIconSelection = select("materials.card.certIcon");
  const certTextSelection = select("materials.card.certText");
  const percentageStyle: React.CSSProperties = {
    ...s["card.percentage"],
    fontVariantNumeric: "tabular-nums",
  };
  const certTextStyle = createInteractiveHoverStyle(s["card.certText"], {
    color: true,
  });
  const dividerColor = s.card?.borderColor ?? "var(--border)";
  const modalSelect = createMaterialsModalSelectionGetter(select);
  const originRowHeight = getResolvedTextLineHeight(
    s["card.origin"],
    tokens.typography.body.fontSize * tokens.typography.body.lineHeight,
  );

  if (materials.length === 0) return null;

  return (
    <Modal
      open={isCertificationDialogOpen}
      onOpenChange={setIsCertificationDialogOpen}
    >
      <div
        className={["flex flex-col gap-xs w-full", wrapperClassName]
          .filter(Boolean)
          .join(" ")}
      >
        <h6 {...titleSelection} style={s.title}>
          Materials
        </h6>

        <div
          {...cardSelection}
          className="grid grid-cols-[max-content_minmax(0,1fr)] overflow-hidden"
          style={s.card}
        >
          {materials.map((material, index) => {
            return (
              <Fragment
                key={`${material.type}-${material.percentage}-${index}`}
              >
                <div className="flex items-start p-md">
                  <span
                    {...percentageSelection}
                    className="inline-grid place-items-center"
                    style={percentageStyle}
                  >
                    {/* Reserve space for the widest supported label so all rows align. */}
                    <span
                      aria-hidden="true"
                      className="col-start-1 row-start-1 invisible"
                    >
                      100%
                    </span>
                    <span className="col-start-1 row-start-1">
                      {material.percentage}%
                    </span>
                  </span>
                </div>
                <div
                  className="min-w-0 flex flex-col gap-xs pt-md pr-md pb-md"
                  style={
                    index !== materials.length - 1
                      ? {
                          borderBottom: `1px solid ${dividerColor}`,
                        }
                      : undefined
                  }
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_max-content] items-start gap-xs">
                    <span
                      {...typeSelection}
                      className="block min-w-0"
                      style={s["card.type"]}
                    >
                      {material.type}
                    </span>
                    {material.certification && (
                      <span
                        {...certificationSelection}
                        className="inline-flex items-center gap-micro px-xs"
                        style={s["card.certification"]}
                      >
                        {showCheckIcon && (
                          <Icons.Check
                            {...certIconSelection}
                            style={s["card.certIcon"]}
                          />
                        )}
                        <span>Certified</span>
                      </span>
                    )}
                  </div>

                  {material.origin && (
                    <div className="flex items-start gap-xs">
                      <div
                        className="flex shrink-0 items-center"
                        style={{ height: originRowHeight }}
                      >
                        <MapPinIcon
                          {...locationIconSelection}
                          style={s["card.locationIcon"]}
                          aria-hidden="true"
                        />
                      </div>
                      <div
                        className="flex items-start"
                        style={{
                          minHeight: originRowHeight,
                          lineHeight: originRowHeight,
                        }}
                      >
                        <span
                          {...originSelection}
                          className="inline-flex items-center"
                          style={{
                            ...s["card.origin"],
                            minHeight: originRowHeight,
                          }}
                        >
                          {material.origin}
                        </span>
                      </div>
                    </div>
                  )}

                  {material.certification && (
                    <button
                      {...certTextSelection}
                      type="button"
                      className={`appearance-none border-0 bg-transparent p-0 w-fit cursor-pointer text-left underline underline-offset-4 ${INTERACTIVE_HOVER_CLASS_NAME}`}
                      style={certTextStyle}
                      onClick={() => {
                        // Keep the selected certification mounted while the dialog animates out.
                        setSelectedCertification(material);
                        setIsCertificationDialogOpen(true);
                      }}
                    >
                      {material.certification.type}
                    </button>
                  )}
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>

      {selectedCertification ? (
        <CertificationModal
          description={`This certification applies to ${selectedCertification.type.toLowerCase()} and is reported as part of this product passport.`}
          facts={buildCertificationModalFacts(selectedCertification)}
          select={modalSelect}
          styles={s}
          subtitle="Certification overview"
          title={selectedCertification.certification?.type ?? "Certification"}
        />
      ) : null}
    </Modal>
  );
}
