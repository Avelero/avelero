import { SmallImpactCard } from './small-impact-card';

interface Props {
  claims: string[];
}

export function SmallImpactFrame({ claims }: Props) {
  return (
    <div className="horizontal-scroll-container">
      <div className="horizontal-scroll-area flex gap-sm">
        {claims.map((claim) => (
          <SmallImpactCard key={claim} claim={claim} />
        ))}
      </div>
    </div>
  );
}
