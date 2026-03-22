"use client";

/**
 * Confirmation dialog shown before downgrading a subscription.
 * Informs the user that the change takes effect at the end of their billing period.
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
import { PLAN_DISPLAY, type PlanTier } from "./plan-features";

export interface DowngradeConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
  toTier: PlanTier;
  toInterval: "quarterly" | "yearly";
  /** End of the current billing period (ISO string). */
  periodEnd: string | null;
}

/**
 * Format the subscription period end for human-readable confirmation copy.
 */
function formatDate(iso: string | null): string {
  // Fall back to a generic label when Stripe has not synced the next renewal date yet.
  if (!iso) return "your next billing date";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function DowngradeConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  toTier,
  toInterval,
  periodEnd,
}: DowngradeConfirmationProps) {
  const toDisplay = PLAN_DISPLAY[toTier];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-foreground">
            Downgrade to {toDisplay.name}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          <DialogDescription className="text-secondary">
            Your plan will change to {toDisplay.name} (
            {toInterval === "yearly" ? "yearly" : "quarterly"}) on{" "}
            <span className="font-medium text-foreground">
              {formatDate(periodEnd)}
            </span>
            . You&apos;ll keep your current plan features until then. Your existing credits are yours to keep — downgrading only reduces the number of new credits added at each renewal.
          </DialogDescription>
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
            {isPending ? "Processing..." : "Confirm downgrade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
