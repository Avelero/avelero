import { Icons } from "@v1/ui/icons";
import { Fragment } from "react";
import { resolveStyles } from "../../lib/resolve-styles";
import { toExternalHref } from "../../lib/url-utils";
import { transformMaterials } from "../_transforms";
import type { SectionProps } from "../registry";

export function MaterialsSection({ section, tokens, data }: SectionProps) {
  const s = resolveStyles(section.styles, tokens);
  const materials = transformMaterials(data);
  const showCheckIcon = section.content.showCertificationCheckIcon !== false;

  if (materials.length === 0) return null;

  return (
    <div className="mx-sm @3xl:mx-0 flex flex-col gap-sm">
      <h6 style={s.title}>Materials</h6>

      <div className="border grid grid-cols-[max-content_1fr]" style={s.card}>
        {materials.map((material, index) => {
          const certHref = toExternalHref(material.certificationUrl);
          return (
            <Fragment key={`${material.type}-${material.percentage}-${index}`}>
              <div className="flex items-start p-md">
                <span style={s["card.percentage"]}>{material.percentage}%</span>
              </div>
              <div
                className="py-md pr-md flex flex-col gap-xs"
                style={
                  index !== materials.length - 1
                    ? {
                        borderBottom: `1px solid ${s.card?.borderColor ?? "var(--border)"}`,
                      }
                    : undefined
                }
              >
                <div className="flex items-start justify-between gap-xs">
                  <span style={s["card.type"]}>{material.type}</span>
                  {material.certification && (
                    <span
                      className="inline-flex items-center gap-micro py-micro px-xs"
                      style={s["card.certification"]}
                    >
                      {showCheckIcon && (
                        <Icons.Check style={s["card.certIcon"]} />
                      )}
                      <span className="!leading-[100%]">Certified</span>
                    </span>
                  )}
                </div>

                <div style={s["card.origin"]}>{material.origin}</div>

                {material.certification &&
                  (certHref ? (
                    <a
                      href={certHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cursor-pointer"
                      style={s["card.certText"]}
                    >
                      {material.certification}
                    </a>
                  ) : (
                    <span style={s["card.certText"]}>
                      {material.certification}
                    </span>
                  ))}
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
