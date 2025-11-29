import type { Material, ThemeConfig } from "@v1/dpp-components";
import { Icons } from "@v1/ui/icons";
import { Fragment } from "react";

interface Props {
  materials: Material[];
  themeConfig: ThemeConfig;
  isLast?: boolean;
}

export function MaterialsFrame({
  materials,
  themeConfig,
  isLast = false,
}: Props) {
  const showCheckIcon = themeConfig.materials.showCertificationCheckIcon;

  return (
    <div
      className={`mx-sm @3xl:mx-0 mt-lg mb-lg flex flex-col gap-sm${isLast ? " mb-0" : ""}`}
    >
      <h6 className="materials-card__title">Materials</h6>

      <div className="materials-card border grid grid-cols-[max-content_1fr]">
        {materials.map((material, index) => (
          <Fragment key={`${material.type}-${material.percentage}-${index}`}>
            <div className="flex items-start p-md">
              <span className="materials-card__percentage">{material.percentage}%</span>
            </div>
            <div
              className="py-md pr-md flex flex-col gap-xs"
              style={
                index !== materials.length - 1
                  ? {
                      borderBottom:
                        "1px solid var(--materials-card-border-color, var(--border))",
                    }
                  : {}
              }
            >
              <div className="flex items-start justify-between gap-xs">
                <span className="materials-card__type">{material.type}</span>

                {material.certification && (
                  <span className="inline-flex items-center gap-micro py-micro px-xs materials-card__certification">
                    {showCheckIcon && <Icons.Check className="w-3 h-3" />}
                    <span className="!leading-[100%]">Certified</span>
                  </span>
                )}
              </div>

              <div className="materials-card__origin">{material.origin}</div>

              {material.certification && (
                <a
                  href={material.certificationUrl}
                  className="materials-card__certification-text cursor-pointer"
                >
                  {material.certification}
                </a>
              )}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
