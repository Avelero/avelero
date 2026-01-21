import { type ImpactMetricDisplay, LargeImpactCard } from "./large-impact-card";

interface Props {
  metrics: ImpactMetricDisplay[];
}

export function ImpactFrame({ metrics }: Props) {
  return (
    <div className="px-sm @3xl:px-0 mt-2x flex flex-col gap-sm">
      <h6 className="impact-card__title">Impact</h6>

      <div className="flex flex-col gap-sm">
        <div className="flex flex-col gap-sm">
          {metrics.map((metric) => (
            <LargeImpactCard key={metric.type} metric={metric} />
          ))}
        </div>
      </div>
    </div>
  );
}
