import type { ThemeConfig } from '@/types/theme-config';
import type { JourneyStage } from '@/types/dpp-data';

interface Props {
  journey: JourneyStage[];
  theme: ThemeConfig;
  isLast?: boolean;
}

export function JourneyFrame({ journey, theme, isLast = false }: Props) {
  const { colors } = theme;
  
  return (
    <div className={`px-sm md:px-0 py-lg flex flex-col gap-sm${isLast ? ' pb-0' : ''}`}>
      <h6 className="type-h6" style={{ color: colors.primaryText }}>
        JOURNEY
      </h6>
      
      <div className="flex flex-col py-md pl-md rounded-rounding" style={{ border: `1px solid ${colors.border}` }}>
        {journey.map((stage, stageIndex) => (
          <div key={stage.name} className="relative flex w-full">
            {/* Timeline connector (vertical line) */}
            {stageIndex < journey.length - 1 && (
              <div
                className="absolute left-[3px] top-[19px] w-[1px]"
                style={{
                  backgroundColor: colors.secondaryText,
                  height: 'calc(100% - 19px)',
                }}
              />
            )}
            
            <div className="flex items-start w-full gap-md">
              {/* Stage dot */}
              <div 
                className="rounded-full flex-shrink-0 w-[7px] h-[7px] mt-[6px]"
                style={{ backgroundColor: colors.secondaryText }}
              />
              
              {/* Stage information */}
              <div className={`flex flex-col ${stageIndex !== journey.length - 1 ? 'pb-md w-full' : 'w-full'}`}>
                <div
                  className={`flex flex-col w-full pr-md gap-xs${stageIndex !== journey.length - 1 ? ' pb-md' : ''}`}
                  style={stageIndex !== journey.length - 1 ? { borderBottom: `1px solid ${colors.border}` } : {}}
                >
                  <span className="type-body" style={{ color: colors.primaryText }}>
                    {stage.name}
                  </span>
                  
                  {stage.companies.map((company) => (
                    <div key={`${company.name}-${company.location}`} className="flex items-center gap-xs type-body-xs">
                      <span style={{ color: colors.secondaryText }}>
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
