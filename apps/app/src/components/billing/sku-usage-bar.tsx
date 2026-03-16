import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import Link from "next/link";

interface SkuUsageBarProps {
  used: number;
  limit: number;
  label: string;
  showUpgradeLink?: boolean;
}

export function SkuUsageBar({
  used,
  limit,
  label,
  showUpgradeLink,
}: SkuUsageBarProps) {
  const percentage = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const isWarning = percentage >= 80 && percentage < 100;
  const isBlocked = percentage >= 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isBlocked && (
            <Icons.CircleAlert className="h-3.5 w-3.5 text-destructive" />
          )}
          {isWarning && (
            <Icons.AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
          )}
          <span className="text-sm text-primary">
            {used.toLocaleString()} of {limit.toLocaleString()} {label}
          </span>
        </div>
        {(isBlocked || showUpgradeLink) && (
          <Link
            href="#change-plan"
            className="text-xs font-medium text-primary underline underline-offset-2"
          >
            Upgrade plan
          </Link>
        )}
      </div>

      <div className="h-3 w-full overflow-hidden bg-[#0000FF]/10">
        <div
          className={cn(
            "h-full transition-all duration-300",
            isBlocked
              ? "bg-destructive"
              : isWarning
                ? "bg-amber-500"
                : "bg-brand",
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
