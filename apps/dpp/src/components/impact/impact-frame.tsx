import type { ThemeConfig } from '@/types/theme-config';
import type { ImpactMetric } from '@/types/dpp-data';
import { LargeImpactCard } from './large-impact-card';
import { SmallImpactFrame } from './small-impact-frame';

interface Props {
  metrics: ImpactMetric[];
  claims: string[];
  theme: ThemeConfig;
  isLast?: boolean;
}

export function ImpactFrame({ metrics, claims, theme, isLast = false }: Props) {
  const { colors } = theme;
  
  return (
    <div className={`px-sm md:px-0 py-lg flex flex-col gap-sm${isLast ? ' pb-0' : ''}`}>
      <h6 className="type-h6" style={{ color: colors.primaryText }}>
        IMPACT
      </h6>
      
      <div className="flex flex-col gap-sm">
        <div className="flex flex-col gap-sm">
          {metrics.map((metric) => (
            <LargeImpactCard key={metric.type} metric={metric} theme={theme} />
          ))}
        </div>
        
        {claims.length > 0 && (
          <div className="overflow-visible w-full">
            <SmallImpactFrame claims={claims} theme={theme} />
          </div>
        )}
      </div>
    </div>
  );
}
