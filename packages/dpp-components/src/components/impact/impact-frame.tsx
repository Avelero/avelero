import type { ImpactMetric } from "@v1/dpp-components";
import { LargeImpactCard } from "./large-impact-card";
import { SmallImpactFrame } from "./small-impact-frame";

interface Props {
  metrics: ImpactMetric[];
  claims: string[];
}

export function ImpactFrame({ metrics, claims }: Props) {
  return (
    <div className="px-sm @3xl:px-0 mt-2x flex flex-col gap-sm">
      <h6 className="impact-card__title">Impact</h6>

      <div className="flex flex-col gap-sm">
        <div className="flex flex-col gap-sm">
          {metrics.map((metric) => (
            <LargeImpactCard key={metric.type} metric={metric} />
          ))}
        </div>

        {claims.length > 0 && (
          <div className="overflow-visible w-full">
            <SmallImpactFrame claims={claims} />
          </div>
        )}
      </div>
    </div>
  );
}
