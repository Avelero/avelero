"use client";

/**
 * Full-screen wrapper for the reusable plan-selector experience.
 */
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
  currentInterval?: "quarterly" | "yearly" | null;
  /** Whether Impact Predictions is currently active. */
  hasImpact?: boolean;
  /** Whether the brand currently has a live Stripe subscription to modify. */
  hasSubscription?: boolean;
  /** Whether the current subscription is scheduled to end at period close. */
  pendingCancellation?: boolean;
  /** Whether Stripe already has a future plan change scheduled. */
  hasScheduledPlanChange?: boolean;
  /** Current billing period start (ISO string). */
  periodStart?: string | null;
  /** Current billing period end (ISO string). */
  periodEnd?: string | null;
  /** Whether the overlay should cover the viewport or only the current parent. */
  position?: "fixed" | "absolute";
}

export function PlanSelectorOverlay({
  // Render the selector in a reusable full-screen shell for paywalls and settings.
  dismissible = true,
  onClose,
  currentPlan = null,
  currentInterval = null,
  hasImpact = false,
  hasSubscription = false,
  pendingCancellation = false,
  hasScheduledPlanChange = false,
  periodStart = null,
  periodEnd = null,
  position = "fixed",
}: PlanSelectorOverlayProps) {
  // Scope the overlay to the requested container so paywalls can preserve app chrome.
  const overlayPositionClass = position === "absolute" ? "absolute" : "fixed";

  return (
    <div
      className={`${overlayPositionClass} inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background`}
    >
      {/* Close button */}
      {dismissible && onClose && (
        <button
          type="button"
          onClick={onClose}
          className={`${overlayPositionClass} top-4 right-4 z-[60] flex h-8 w-8 items-center justify-center rounded-md text-secondary transition-colors hover:bg-accent hover:text-primary`}
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
          hasSubscription={hasSubscription}
          pendingCancellation={pendingCancellation}
          hasScheduledPlanChange={hasScheduledPlanChange}
          periodStart={periodStart}
          periodEnd={periodEnd}
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
