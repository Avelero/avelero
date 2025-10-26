import type { ThemeConfig } from '@/types/theme-config';
import { SmallImpactCard } from './small-impact-card';

interface Props {
  claims: string[];
  theme: ThemeConfig;
}

export function SmallImpactFrame({ claims, theme }: Props) {
  return (
    <div className="horizontal-scroll-container">
      <div className="horizontal-scroll-area flex gap-sm">
        {claims.map((claim) => (
          <SmallImpactCard key={claim} claim={claim} theme={theme} />
        ))}
      </div>
    </div>
  );
}
