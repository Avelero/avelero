"use client";

/**
 * Confirmation dialog shown before upgrading/downgrading a subscription.
 * Displays prorated pricing breakdown so the customer knows what to expect.
 */
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import {
  PLAN_DISPLAY,
  formatPrice,
  type PlanTier,
} from "./plan-features";

export interface UpgradeConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
  /** The tier the customer is moving FROM. */
  fromTier: PlanTier;
  fromInterval: "monthly" | "yearly";
  /** The tier the customer is moving TO. */
  toTier: PlanTier;
  toInterval: "monthly" | "yearly";
  /** Current billing period start (ISO string). */
  periodStart: string | null;
  /** Current billing period end (ISO string). */
  periodEnd: string | null;
}

/**
 * Calculates the fraction of the billing period remaining (0–1).
 */
function getRemainingFraction(
  periodStart: string | null,
  periodEnd: string | null,
): number {
  if (!periodStart || !periodEnd) return 1;
  const startMs = new Date(periodStart).getTime();
  const endMs = new Date(periodEnd).getTime();
  const nowMs = Date.now();
  const totalMs = endMs - startMs;
  if (totalMs <= 0) return 1;
  const remainingMs = Math.max(0, endMs - nowMs);
  return Math.min(1, remainingMs / totalMs);
}

/**
 * Returns the period price for a given tier + interval.
 */
function getPeriodPrice(tier: PlanTier, interval: "monthly" | "yearly"): number {
  const display = PLAN_DISPLAY[tier];
  if (interval === "yearly") return display.yearlyPrice ?? 0;
  return display.monthlyPrice ?? 0;
}

/**
 * Returns a human-readable label for the billing interval.
 */
function intervalLabel(interval: "monthly" | "yearly"): string {
  return interval === "yearly" ? "year" : "month";
}

export function UpgradeConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  fromTier,
  fromInterval,
  toTier,
  toInterval,
  periodStart,
  periodEnd,
}: UpgradeConfirmationProps) {
  const fromDisplay = PLAN_DISPLAY[fromTier];
  const toDisplay = PLAN_DISPLAY[toTier];

  const fromPrice = getPeriodPrice(fromTier, fromInterval);
  const toPrice = getPeriodPrice(toTier, toInterval);

  const remaining = getRemainingFraction(periodStart, periodEnd);

  // Prorated credit for unused portion of current plan
  const credit = Math.round(fromPrice * remaining);
  // Prorated charge for remaining portion on new plan
  const charge = Math.round(toPrice * remaining);
  // Net amount (positive = customer pays, negative = credit)
  const net = charge - credit;

  const isUpgrade = toPrice > fromPrice || toInterval === "yearly";
  const isIntervalChange = fromInterval !== toInterval;
  const isTierChange = fromTier !== toTier;

  let title: string;
  if (isTierChange && isIntervalChange) {
    title = `Switch to ${toDisplay.name} (${toInterval})`;
  } else if (isIntervalChange) {
    title = `Switch to ${toInterval} billing`;
  } else if (isUpgrade) {
    title = `Upgrade to ${toDisplay.name}`;
  } else {
    title = `Downgrade to ${toDisplay.name}`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-foreground">{title}</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          <DialogDescription className="text-secondary">
            Your plan will change immediately. Stripe will adjust your next
            invoice with prorated charges.
          </DialogDescription>

          {/* Plan change summary */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-secondary">Current plan</span>
              <span className="text-foreground font-medium">
                {fromDisplay.name} ({formatPrice(fromPrice)}/{intervalLabel(fromInterval)})
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-secondary">New plan</span>
              <span className="text-foreground font-medium">
                {toDisplay.name} ({formatPrice(toPrice)}/{intervalLabel(toInterval)})
              </span>
            </div>
          </div>

          {/* Proration breakdown */}
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-xs font-medium text-secondary uppercase tracking-wider">
              Estimated proration
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-secondary">
                Credit for unused {fromDisplay.name}
              </span>
              <span className="text-foreground">
                &minus;{formatPrice(credit)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-secondary">
                {toDisplay.name} for remaining period
              </span>
              <span className="text-foreground">
                {formatPrice(charge)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm border-t border-border pt-2">
              <span className="text-foreground font-medium">
                Estimated adjustment
              </span>
              <span className="text-foreground font-medium">
                {net >= 0 ? formatPrice(net) : `\u2212${formatPrice(Math.abs(net))} credit`}
              </span>
            </div>
            <p className="text-xs text-tertiary">
              This is an estimate. The exact amount is calculated by Stripe at
              the time of the change and will appear on your next invoice.
            </p>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "Updating..." : "Confirm change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
