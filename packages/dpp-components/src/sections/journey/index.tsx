/**
 * Journey sidebar section.
 *
 * Renders the product journey as a vertical timeline inside a shadowed card shell.
 */
import { MapPinIcon } from "@phosphor-icons/react/dist/ssr/MapPin";
import { createSectionSelectionAttributes } from "../../lib/editor-selection";
import { resolveStyles } from "../../lib/resolve-styles";
import { toExternalHref } from "../../lib/url-utils";
import { transformJourney } from "../_transforms";
import type { SectionProps } from "../registry";

export function JourneySection({
  section,
  tokens,
  data,
  zoneId,
  wrapperClassName,
}: SectionProps) {
  // Resolve styles and build the stage timeline for the sidebar card.
  const s = resolveStyles(section.styles, tokens);
  const journey = transformJourney(data);
  const select = createSectionSelectionAttributes(section.id, zoneId);
  const titleSelection = select("journey.title");
  const cardSelection = select("journey.card");
  const typeSelection = select("journey.card.type");
  const operatorSelection = select("journey.card.operator");
  const locationSelection = select("journey.card.location");
  const locationIconSelection = select("journey.card.locationIcon");
  const lineSelection = select("journey.card.line");
  const dotSelection = select("journey.card.dot");
  const cardStyle: React.CSSProperties = {
    ...s.card,
    border: "none",
  };

  if (journey.length === 0) return null;

  // Use resolved colors for the timeline and stage dividers, with border as fallback.
  const lineColor = s["card.line"]?.backgroundColor ?? "var(--border)";
  const dotColor = s["card.dot"]?.backgroundColor ?? lineColor;
  const dividerColor = s.card?.borderColor ?? "var(--border)";

  return (
    <div
      className={["flex flex-col gap-md w-full", wrapperClassName]
        .filter(Boolean)
        .join(" ")}
    >
      <h6 {...titleSelection} style={s.title}>
        Journey
      </h6>

      <div {...cardSelection} className="overflow-hidden" style={cardStyle}>
        {journey.map((stage, stageIndex) => (
          <div
            key={stage.id}
            className="grid grid-cols-[22px_minmax(0,1fr)] gap-x-lg px-lg py-xl"
            style={
              stageIndex !== journey.length - 1
                ? {
                    borderBottom: `1px solid ${dividerColor}`,
                  }
                : undefined
            }
          >
            <div className="relative flex justify-center">
              {stageIndex < journey.length - 1 && (
                <div
                  {...lineSelection}
                  className="absolute top-[14px] bottom-[-32px] left-1/2 -translate-x-1/2 border-l border-dashed"
                  style={{ borderColor: lineColor }}
                />
              )}
              <div
                {...dotSelection}
                className="relative z-10 mt-[6px] h-[14px] w-[14px] rounded-full"
                style={{ backgroundColor: dotColor }}
              />
            </div>

            <div className="min-w-0 flex flex-col gap-lg">
              <span {...typeSelection} style={s["card.type"]}>
                {stage.name}
              </span>

              <div className="flex flex-col gap-md">
                {stage.companies.map((company) => {
                  const operatorHref = toExternalHref(company.url);

                  return (
                    <div
                      key={`${stageIndex}-${company.name}-${company.location}`}
                      className="flex items-start gap-sm"
                    >
                      <MapPinIcon
                        {...locationIconSelection}
                        className="mt-[2px] shrink-0"
                        style={s["card.locationIcon"]}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex flex-wrap items-baseline gap-xs">
                        {operatorHref ? (
                          <a
                            {...operatorSelection}
                            href={operatorHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="cursor-pointer underline underline-offset-4"
                            style={s["card.operator"]}
                          >
                            {company.name}
                          </a>
                        ) : (
                          <span
                            {...operatorSelection}
                            className="underline underline-offset-4"
                            style={s["card.operator"]}
                          >
                            {company.name}
                          </span>
                        )}
                        {company.location && (
                          <span
                            {...locationSelection}
                            style={s["card.location"]}
                          >
                            • {company.location}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
