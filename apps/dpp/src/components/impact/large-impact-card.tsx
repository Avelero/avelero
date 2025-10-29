import type { ThemeConfig } from '@/types/theme-config';
import type { ImpactMetric } from '@/types/dpp-data';
import { Icons } from '@v1/ui/icons';

interface Props {
  metric: ImpactMetric;
  themeConfig: ThemeConfig;
}

export function LargeImpactCard({ metric, themeConfig }: Props) {
  
  const iconMap = {
    leaf: Icons.Leaf,
    drop: Icons.Droplets,
    recycle: Icons.Recycle,
    factory: Icons.Factory,
  };
  
  // Default colors per icon type
  const iconColorMap = {
    leaf: '#03A458',     // Green
    drop: '#0000FF',     // Blue
    recycle: '#0000FF',  // Blue
    factory: '#6B7280',  // Grey-ish
  };
  
  const IconComponent = iconMap[metric.icon] ?? Icons.Leaf; // Safe fallback
  const iconColor = metric.iconColor || iconColorMap[metric.icon] || iconColorMap.leaf;
  
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
      <IconComponent className="w-7 h-7" style={{ color: iconColor }} />
    </div>
  );
}
