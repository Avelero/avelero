import type { ThemeConfig } from '@/types/theme-config';
import { Icons } from '@v1/ui/icons';
import { truncateText } from '@/lib/utils/formatting';

interface Props {
  claim: string;
  theme: ThemeConfig;
}

export function SmallImpactCard({ claim, theme }: Props) {
  const { colors } = theme;
  const truncatedClaim = truncateText(claim, 40);
  
  return (
    <div
      className="px-md py-sm flex items-center rounded-rounding whitespace-nowrap flex-shrink-0"
      style={{ border: `1px solid ${colors.border}` }}
    >
      <div className="flex items-center gap-xs">
        <Icons.Check className="w-[17.5px] h-[17.5px]" style={{ color: colors.highlight }} />
        <div className="type-body-sm" style={{ color: colors.primaryText }}>
          {truncatedClaim}
        </div>
      </div>
    </div>
  );
}
