/**
 * Materials sidebar section.
 *
 * Renders the transformed material composition as shadowed cards with badges and certification links.
 */
import { MapPinIcon } from "@phosphor-icons/react/dist/ssr/MapPin";
import { Icons } from "@v1/ui/icons";
import { Fragment } from "react";
import { createSectionSelectionAttributes } from "../../lib/editor-selection";
import { resolveStyles } from "../../lib/resolve-styles";
import { transformMaterials } from "../_transforms";
import type { SectionProps } from "../registry";

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
  const cardStyle: React.CSSProperties = {
    ...s.card,
    border: "none",
  };
  const dividerColor = s.card?.borderColor ?? "var(--border)";

  if (materials.length === 0) return null;

  return (
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
        style={cardStyle}
      >
        {materials.map((material, index) => {
          return (
            <Fragment key={`${material.type}-${material.percentage}-${index}`}>
              <div className="flex items-start p-md">
                <span
                  {...percentageSelection}
                  className="block"
                  style={s["card.percentage"]}
                >
                  {material.percentage}%
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
                  <div className="flex items-center gap-xs">
                    <div className="flex h-[21px] shrink-0 items-center">
                      <MapPinIcon
                        {...locationIconSelection}
                        style={s["card.locationIcon"]}
                        aria-hidden="true"
                      />
                    </div>
                    <span {...originSelection} style={s["card.origin"]}>
                      {material.origin}
                    </span>
                  </div>
                )}

                {material.certification && (
                  <button
                    {...certTextSelection}
                    type="button"
                    className="w-fit cursor-pointer text-left underline underline-offset-4"
                    style={s["card.certText"]}
                  >
                    {material.certification}
                  </button>
                )}
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
