"use client";

import { Icons } from "@v1/ui/icons";
import { PlanSelector } from "./plan-selector";

interface PlanSelectorOverlayProps {
  /** Whether the overlay can be dismissed (false for paywall). */
  dismissible?: boolean;
  /** Called when the overlay is closed (only when dismissible). */
  onClose?: () => void;
  /** Current plan tier (null for trial/expired brands). */
  currentPlan?: "starter" | "growth" | "scale" | null;
  /** Current billing interval. */
  currentInterval?: "monthly" | "yearly" | null;
  /** Whether Impact Predictions is currently active. */
  hasImpact?: boolean;
}

export function PlanSelectorOverlay({
  dismissible = true,
  onClose,
  currentPlan = null,
  currentInterval = null,
  hasImpact = false,
}: PlanSelectorOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background">
      {/* Close button */}
      {dismissible && onClose && (
        <button
          type="button"
          onClick={onClose}
          className="fixed top-4 right-4 z-[60] flex h-8 w-8 items-center justify-center rounded-md text-secondary transition-colors hover:bg-accent hover:text-primary"
          aria-label="Close"
        >
          <Icons.X className="h-4 w-4" />
        </button>
      )}

      {/* Centered content */}
      <div className="w-full max-w-[1100px] px-6 py-16">
        <PlanSelector
          currentPlan={currentPlan}
          currentInterval={currentInterval}
          hasImpact={hasImpact}
          context="paywall"
        />

        <p className="mt-8 text-center text-sm text-secondary">
          Need higher limits for your business?{" "}
          <a
            href="mailto:raf@avelero.com"
            className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
          >
            Contact Founders
          </a>
        </p>
      </div>
    </div>
  );
}
