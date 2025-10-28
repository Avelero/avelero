import type { ThemeConfig } from '@/types/theme-config';
import type { ImpactMetric } from '@/types/dpp-data';
import { Icons } from '@v1/ui/icons';

interface Props {
  metric: ImpactMetric;
  theme: ThemeConfig;
}

export function LargeImpactCard({ metric, theme }: Props) {
  const { colors } = theme;
  
  const iconMap = {
    leaf: Icons.Leaf,
    drop: Icons.Droplet,
    recycle: Icons.Recycle,
    factory: Icons.Factory,
  };
  
  const IconComponent = iconMap[metric.icon];
  const iconColor = metric.iconColor || colors.primaryGreen;
  
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
