import type { ThemeConfig } from '@/types/theme-config';
import type { ImpactMetric } from '@/types/dpp-data';
import { Icons } from '@v1/ui/icons';

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
  
  const iconClassMap = {
    leaf: 'impact-card__icon-leaf',
    drop: 'impact-card__icon-drop',
    recycle: 'impact-card__icon-recycle',
    factory: 'impact-card__icon-factory',
  };
  
  const IconComponent = iconMap[metric.icon] ?? Icons.Leaf; // Safe fallback
  const iconClass = iconClassMap[metric.icon] ?? iconClassMap.leaf;
  
  return (
    <div
      className="p-md impact-card border flex justify-between items-center"
    >
      <div className="flex flex-col gap-xs">
        <div className="impact-card__type">
          {metric.type}
        </div>
        <div className="flex items-end gap-micro">
          <div className="impact-card__value">
            {metric.value}
          </div>
          <div className="impact-card__unit">
            {metric.unit}
          </div>
        </div>
      </div>
      <IconComponent className={`w-7 h-7 ${iconClass}`} style={metric.iconColor ? { color: metric.iconColor } : undefined} />
    </div>
  );
}
