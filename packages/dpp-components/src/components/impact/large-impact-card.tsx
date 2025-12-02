import type { ImpactMetric } from "@v1/dpp-components";
import { Icons } from "@v1/ui/icons";

interface Props {
  metric: ImpactMetric;
}

export function LargeImpactCard({ metric }: Props) {
  const iconMap = {
    leaf: Icons.Leaf,
    drop: Icons.Droplets,
    recycle: Icons.Recycle,
    factory: Icons.Factory,
  };

  const IconComponent = iconMap[metric.icon] ?? Icons.Leaf; // Safe fallback

  return (
    <div className="p-md impact-card border flex justify-between items-center">
      <div className="flex flex-col gap-xs">
        <div className="impact-card__type">{metric.type}</div>
        <div className="flex items-end gap-micro">
          <div className="impact-card__value">{metric.value}</div>
          <div className="impact-card__unit">{metric.unit}</div>
        </div>
      </div>
      <IconComponent
        className="impact-card__icon"
        style={metric.iconColor ? { color: metric.iconColor } : undefined}
      />
    </div>
  );
}
