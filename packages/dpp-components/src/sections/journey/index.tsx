import { resolveStyles } from "../../lib/resolve-styles";
import { transformJourney } from "../_transforms";
import type { SectionProps } from "../registry";

export function JourneySection({ section, tokens, data }: SectionProps) {
  const s = resolveStyles(section.styles, tokens);
  const journey = transformJourney(data);

  if (journey.length === 0) return null;

  // Use resolved line color for dot + connector, fall back to border token
  const lineColor = s["card.line"]?.backgroundColor ?? "var(--border)";

  return (
    <div className="mx-sm @3xl:mx-0 flex flex-col gap-sm">
      <h6 style={s.title}>Journey</h6>

      <div
        className="flex flex-col py-md pl-md border"
        style={{ borderColor: s.card?.borderColor }}
      >
        {journey.map((stage, stageIndex) => (
          <div key={stage.id} className="relative flex w-full">
            {/* Timeline connector */}
            {stageIndex < journey.length - 1 && (
              <div
                className="absolute left-[3px] top-[19px] w-[1px]"
                style={{
                  backgroundColor: lineColor,
                  height: "calc(100% - 19px)",
                }}
              />
            )}

            <div className="flex items-start w-full gap-md">
              {/* Stage dot */}
              <div
                className="rounded-full flex-shrink-0 w-[7px] h-[7px] mt-[6px]"
                style={{ backgroundColor: lineColor }}
              />

              {/* Stage info */}
              <div
                className={`flex flex-col ${stageIndex !== journey.length - 1 ? "pb-md w-full" : "w-full"}`}
              >
                <div
                  className={`flex flex-col w-full pr-md gap-xs${stageIndex !== journey.length - 1 ? " pb-md" : ""}`}
                  style={
                    stageIndex !== journey.length - 1
                      ? {
                          borderBottom: `1px solid ${s.card?.borderColor ?? "var(--border)"}`,
                        }
                      : undefined
                  }
                >
                  <span style={s["card.type"]}>{stage.name}</span>
                  {stage.companies.map((company) => (
                    <div
                      key={`${stageIndex}-${company.name}-${company.location}`}
                      className="flex items-center gap-xs"
                      style={s["card.operator"]}
                    >
                      <span>
                        {company.name}
                        {company.name && company.location && " \u2022 "}
                        {company.location}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
