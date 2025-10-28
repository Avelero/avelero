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
    <div className={`mx-sm md:mx-0 mt-lg mb-lg md:mb-0 flex flex-col gap-sm${isLast ? ' mb-0' : ''}`}>
      <h6 className="impact-card__title">
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
