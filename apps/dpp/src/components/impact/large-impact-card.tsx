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
      className="p-md flex justify-between rounded-rounding items-center"
      style={{ border: `1px solid ${colors.border}` }}
    >
      <div className="flex flex-col gap-xs">
        <div className="type-body-xs" style={{ color: colors.secondaryText }}>
          {metric.type}
        </div>
        <div className="flex items-end gap-micro">
          <div className="type-h2" style={{ color: colors.primaryText }}>
            {metric.value}
          </div>
          <div className="type-body-xs" style={{ color: colors.secondaryText }}>
            {metric.unit}
          </div>
        </div>
      </div>
      <IconComponent className="w-7 h-7" style={{ color: iconColor }} />
    </div>
  );
}
