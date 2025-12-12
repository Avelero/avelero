import type { JourneyStage, ThemeConfig } from "@v1/dpp-components";

interface Props {
  journey: JourneyStage[];
  themeConfig: ThemeConfig;
}

export function JourneyFrame({ journey, themeConfig }: Props) {
  return (
    <div className="mx-sm @3xl:mx-0 mt-2x flex flex-col gap-sm">
      <h6 className="journey-card__title">Journey</h6>

      <div className="flex flex-col py-md pl-md journey-card border">
        {journey.map((stage, stageIndex) => (
          <div key={stage.id} className="relative flex w-full">
            {/* Timeline connector (vertical line) */}
            {stageIndex < journey.length - 1 && (
              <div
                className="absolute left-[3px] top-[19px] w-[1px] journey-card__line"
                style={{ height: "calc(100% - 19px)" }}
              />
            )}

            <div className="flex items-start w-full gap-md">
              {/* Stage dot */}
              <div className="journey-card__line rounded-full flex-shrink-0 w-[7px] h-[7px] mt-[6px]" />

              {/* Stage information */}
              <div
                className={`flex flex-col ${stageIndex !== journey.length - 1 ? "pb-md w-full" : "w-full"}`}
              >
                <div
                  className={`flex flex-col w-full pr-md gap-xs${stageIndex !== journey.length - 1 ? " pb-md" : ""}`}
                  style={
                    stageIndex !== journey.length - 1
                      ? {
                          borderBottom:
                            "1px solid var(--journey-card-border-color, var(--border))",
                        }
                      : {}
                  }
                >
                  <span className="journey-card__type">{stage.name}</span>

                  {stage.companies.map((company) => (
                    <div
                      key={`${stageIndex}-${company.name}-${company.location}`}
                      className="flex items-center gap-xs journey-card__operator"
                    >
                      <span>
                        {company.name} • {company.location}
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
