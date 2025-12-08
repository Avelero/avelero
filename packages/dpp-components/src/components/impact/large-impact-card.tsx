import type { ImpactMetric } from "@v1/dpp-components";
import { Icons } from "@v1/ui/icons";
import { LeafIcon } from "@phosphor-icons/react/dist/ssr/Leaf";
import { DropIcon } from "@phosphor-icons/react/dist/ssr/Drop";
import { RecycleIcon } from "@phosphor-icons/react/dist/ssr/Recycle";
import { FactoryIcon } from "@phosphor-icons/react/dist/ssr/Factory";


interface Props {
  metric: ImpactMetric;
}

export function LargeImpactCard({ metric }: Props) {
  const iconMap = {
    leaf: LeafIcon,
    drop: DropIcon,
    recycle: RecycleIcon,
    factory: FactoryIcon,
  };

  const IconComponent = iconMap[metric.icon] ?? LeafIcon; // Safe fallback

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
