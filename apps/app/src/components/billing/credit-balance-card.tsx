/**
 * Displays the brand's credit balance and publishing usage.
 *
 * Designed to clearly communicate:
 * 1. What credits are and how they work
 * 2. How many are available right now
 * 3. Current usage at a glance
 * 4. When the next credits arrive
 */
import type { ReactNode } from "react";

interface CreditBalanceCardProps {
  description: string;
  totalCredits: number;
  publishedCount: number;
  remainingCredits: number;
  utilization: number | null;
  /** Next renewal date (ISO string or Date). Null if no active subscription. */
  nextRenewalAt: string | Date | null;
  /** Number of credits awarded on next renewal. Null if unknown. */
  nextCreditGrant: number | null;
  action?: ReactNode;
}

export function CreditBalanceCard({
  description,
  totalCredits,
  publishedCount,
  remainingCredits,
  utilization,
  nextRenewalAt,
  nextCreditGrant,
  action,
}: CreditBalanceCardProps) {
  const percentage =
    utilization != null && Number.isFinite(utilization)
      ? Math.round(utilization * 100)
      : 0;

  const renewalDate = formatRenewalDate(nextRenewalAt);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h4 className="type-h5 text-foreground">Passport credits</h4>
          <p className="max-w-[48ch] text-sm text-secondary">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      {/* Key stats */}
      <div className="border border-border p-5">
        <div className="flex gap-10">
          <div>
            <p className="text-xs text-secondary">Available credits</p>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-primary">
              {remainingCredits.toLocaleString("en-US")}
            </p>
          </div>
          <div>
            <p className="text-xs text-secondary">Total credits</p>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-primary">
              {totalCredits.toLocaleString("en-US")}
            </p>
          </div>
        </div>

        {/* Usage bar */}
        <div className="mt-5 border-t border-border pt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-secondary">Published passports</span>
            <span className="text-secondary">
              {publishedCount.toLocaleString("en-US")} of{" "}
              {totalCredits.toLocaleString("en-US")}
            </span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden bg-[#0000FF]/10">
            <div
              className="h-full bg-brand transition-all duration-300"
              style={{ width: `${Math.min(100, percentage)}%` }}
            />
          </div>
        </div>

        {/* Next renewal */}
        {renewalDate && nextCreditGrant ? (
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-xs text-secondary">Next credit top-up</p>
            <p className="mt-1 text-sm text-primary">
              {nextCreditGrant.toLocaleString("en-US")} passports on{" "}
              {renewalDate}
            </p>
          </div>
        ) : null}
      </div>

      {/* How credits work */}
      <div className="border border-border p-5">
        <p className="text-sm font-medium text-foreground">How credits work</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-secondary">
          <li>
            Each published passport uses one credit. Unpublishing frees it up
            again.
          </li>
          <li>
            New credits are added to your balance with each subscription
            payment.
          </li>
          <li>
            Credits never expire as long as your subscription is active.
          </li>
        </ul>
      </div>
    </div>
  );
}

function formatRenewalDate(
  nextRenewalAt: string | Date | null,
): string | null {
  if (!nextRenewalAt) return null;

  const date = new Date(nextRenewalAt);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
