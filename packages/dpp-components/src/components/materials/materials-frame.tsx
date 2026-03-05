/**
 * Materials frame for composition and certification rendering.
 */
import type { ThemeConfig } from "@v1/dpp-components";
import { Icons } from "@v1/ui/icons";
import { Fragment } from "react";

/**
 * Display-only material type for UI rendering.
 * Data is transformed from MaterialComposition in InformationFrame.
 */
interface MaterialDisplay {
  percentage: number;
  type: string;
  origin: string;
  certification?: string;
  certificationUrl?: string;
}

interface Props {
  materials: MaterialDisplay[];
  themeConfig: ThemeConfig;
}

function toExternalHref(url?: string): string | undefined {
  // Normalize optional URLs so external certification links resolve consistently.
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function MaterialsFrame({ materials, themeConfig }: Props) {
  // Render material rows with optional certification badges and organization links.
  const showCheckIcon = themeConfig.materials.showCertificationCheckIcon;

  return (
    <div className="mx-sm @3xl:mx-0 mt-2x flex flex-col gap-sm">
      <h6 className="materials-card__title">Materials</h6>

      <div className="materials-card border grid grid-cols-[max-content_1fr]">
        {materials.map((material, index) => {
          const certificationHref = toExternalHref(material.certificationUrl);

          return (
            <Fragment key={`${material.type}-${material.percentage}-${index}`}>
              <div className="flex items-start p-md">
                <span className="materials-card__percentage">
                  {material.percentage}%
                </span>
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
                      {showCheckIcon && (
                        <Icons.Check className="materials-card__certification-icon" />
                      )}
                      <span className="!leading-[100%]">Certified</span>
                    </span>
                  )}
                </div>

                <div className="materials-card__origin">{material.origin}</div>

                {material.certification &&
                  (certificationHref ? (
                    <a
                      href={certificationHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="materials-card__certification-text cursor-pointer"
                    >
                      {material.certification}
                    </a>
                  ) : (
                    <span
                      className="materials-card__certification-text"
                      style={{
                        color:
                          "var(--materials-card-origin-color, var(--muted-foreground))",
                      }}
                    >
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
