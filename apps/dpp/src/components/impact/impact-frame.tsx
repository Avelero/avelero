import type { ThemeConfig } from '@/types/theme-config';
import type { ImpactMetric } from '@/types/dpp-data';
import { LargeImpactCard } from './large-impact-card';
import { SmallImpactFrame } from './small-impact-frame';

interface Props {
  metrics: ImpactMetric[];
  claims: string[];
  themeConfig: ThemeConfig;
  isLast?: boolean;
}

export function ImpactFrame({ metrics, claims, themeConfig, isLast = false }: Props) {
  
  return (
    <div className={`mx-sm md:mx-0 mt-lg mb-lg md:mb-0 flex flex-col gap-sm${isLast ? ' mb-0' : ''}`}>
      <h6 className="impact-card__title">
        IMPACT
      </h6>
      
      <div className="flex flex-col gap-sm">
        <div className="flex flex-col gap-sm">
          {metrics.map((metric) => (
            <LargeImpactCard key={metric.type} metric={metric} themeConfig={themeConfig} />
          ))}
        </div>
        
        {claims.length > 0 && (
          <div className="overflow-visible w-full">
            <SmallImpactFrame claims={claims} themeConfig={themeConfig} />
          </div>
        )}
      </div>
    </div>
  );
}
