import type { ImpactMetric } from "@v1/dpp-components";
import { LargeImpactCard } from "./large-impact-card";
import { SmallImpactFrame } from "./small-impact-frame";

interface Props {
  metrics: ImpactMetric[];
  claims: string[];
  isLast?: boolean;
}

export function ImpactFrame({ metrics, claims, isLast = false }: Props) {
  return (
    <div
      className={`px-sm @3xl:px-0 pt-lg pb-lg flex flex-col gap-sm${isLast ? " pb-0" : ""}`}
    >
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
