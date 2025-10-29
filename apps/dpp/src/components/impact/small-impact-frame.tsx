import type { ThemeConfig } from '@/types/theme-config';
import { SmallImpactCard } from './small-impact-card';

interface Props {
  claims: string[];
  themeConfig: ThemeConfig;
}

export function SmallImpactFrame({ claims, themeConfig }: Props) {
  return (
    <div className="horizontal-scroll-container">
      <div className="horizontal-scroll-area flex gap-sm">
        {claims.map((claim) => (
          <SmallImpactCard key={claim} claim={claim} themeConfig={themeConfig} />
        ))}
      </div>
    </div>
  );
}
