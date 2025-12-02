import { Icons } from "@v1/ui/icons";
import { truncateText } from "../../utils/formatting";

interface Props {
  claim: string;
}

export function SmallImpactCard({ claim }: Props) {
  const truncatedClaim = truncateText(claim, 40);

  return (
    <div className="px-md py-sm impact-card__eco-claim border flex items-center whitespace-nowrap flex-shrink-0">
      <div className="flex items-center gap-xs">
        <Icons.Check className="impact-card__eco-claim-icon" />
        <div className="impact-card__eco-claim-text">{truncatedClaim}</div>
      </div>
    </div>
  );
}
