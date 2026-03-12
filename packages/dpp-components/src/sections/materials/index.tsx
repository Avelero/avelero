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
import {
  buildCertificationModalDescription,
  buildCertificationModalFacts,
  buildCertificationModalMapQuery,
} from "../../components/modals/certification/helpers";
import { createSectionSelectionAttributes } from "../../lib/editor-selection";
import { useHapticTap } from "../../lib/haptics";
import { INTERACTIVE_HOVER_CLASS_NAME } from "../../lib/interactive-hover";
import { resolveStyles } from "../../lib/resolve-styles";
import { getResolvedTextLineHeight } from "../../lib/text-line-height";
import { createUnderlinedActionStyle } from "../../lib/underlined-action";
import { toExternalHref } from "../../lib/url-utils";
import type { SectionProps } from "../registry";
import { transformMaterials } from "../transforms";

export function MaterialsSection({
  section,
  tokens,
  data,
  zoneId,
  wrapperClassName,
  modalContent,
  modalStyles,
  forceModalType,
}: SectionProps) {
  // Resolve styles and shape the materials data for the sidebar card.
  const s = resolveStyles(section.styles, tokens);
  const isForceOpen = forceModalType === "materials";
  const materials = transformMaterials(data);
  const [isCertificationDialogOpen, setIsCertificationDialogOpen] =
    useState(false);
  const hapticTap = useHapticTap();
  const [selectedCertification, setSelectedCertification] = useState<
    ReturnType<typeof transformMaterials>[number] | null
  >(null);
  const showCheckIcon = section.styles["card.certIcon"]?.visible !== false;
  const select = createSectionSelectionAttributes(section.id, zoneId);
  const rootSelection = select("materials");
  const percentageStyle: React.CSSProperties = {
    ...s["card.percentage"],
    fontVariantNumeric: "tabular-nums",
  };
  const certTypeStyle = createUnderlinedActionStyle(s["card.certText"], {
    customFonts: tokens.fonts,
    defaultColor: tokens.colors.link,
  });
  const dividerColor = s.card?.borderColor ?? "var(--border)";
  const showExactLocation = modalContent?.showExactLocation !== false;
  const originRowHeight = getResolvedTextLineHeight(
    s["card.origin"],
    tokens.typography.body.fontSize * tokens.typography.body.lineHeight,
  );

  if (materials.length === 0) return null;

  return (
    <Modal
      open={isCertificationDialogOpen || isForceOpen}
      onOpenChange={setIsCertificationDialogOpen}
      modal={!isForceOpen}
    >
      <div
        {...rootSelection}
        className={["flex flex-col gap-xs w-full", wrapperClassName]
          .filter(Boolean)
          .join(" ")}
      >
        <h6 style={s.title}>Materials</h6>

        <div
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
                    <span className="block min-w-0" style={s["card.type"]}>
                      {material.type}
                    </span>
                    {material.certification && (
                      <span
                        className="inline-flex items-center gap-micro px-xs"
                        style={s["card.certification"]}
                      >
                        {showCheckIcon && (
                          <Icons.Check style={s["card.certIcon"]} />
                        )}
                        <span style={s["card.certLabel"]}>Certified</span>
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
                      type="button"
                      className={`w-fit appearance-none border-0 bg-transparent p-0 cursor-pointer text-left ${INTERACTIVE_HOVER_CLASS_NAME}`}
                      style={certTypeStyle}
                      onClick={() => {
                        hapticTap();
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

      {(() => {
        const certMaterial =
          selectedCertification ??
          (isForceOpen ? materials.find((m) => m.certification) ?? null : null);
        if (!certMaterial) return null;
        return (
          <CertificationModal
            certificateUrl={
              certMaterial.certification?.documentUrl
                ? toExternalHref(certMaterial.certification.documentUrl) ??
                  undefined
                : undefined
            }
            customFonts={tokens.fonts}
            description={buildCertificationModalDescription(certMaterial.type)}
            facts={buildCertificationModalFacts(
              certMaterial.certification,
              modalStyles ?? {},
              tokens.fonts,
            )}
            mapQuery={buildCertificationModalMapQuery(
              certMaterial.certification,
              showExactLocation,
            )}
            styles={modalStyles ?? {}}
            subtitle="Certification overview"
            title={certMaterial.certification?.type ?? "Certification"}
          />
        );
      })()}
    </Modal>
  );
}
