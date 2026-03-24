/**
 * Shared progress bar for displaying the single active SKU budget.
 */
import { Icons } from "@v1/ui/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";

interface SkuUsageBarProps {
  used: number;
  totalCredits: number;
  label: string;
  infoTooltip?: string;
}

/**
 * Renders one SKU usage bar with contextual tooltip copy.
 */
export function SkuUsageBar({
  used,
  totalCredits,
  label,
  infoTooltip,
}: SkuUsageBarProps) {
  const percentage =
    totalCredits > 0 ? Math.min(100, (used / totalCredits) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-2 text-sm text-primary">
          <span>
            {used.toLocaleString()} of {totalCredits.toLocaleString()} {label}
          </span>
          {infoTooltip ? (
            <TooltipProvider delayDuration={120}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-4 w-4 cursor-default items-center justify-center text-secondary transition-colors hover:text-primary"
                    aria-label="Usage information"
                  >
                    <Icons.Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{infoTooltip}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </span>
      </div>

      <div className="h-3 w-full overflow-hidden bg-[#0000FF]/10">
        <div
          className="h-full bg-brand transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
