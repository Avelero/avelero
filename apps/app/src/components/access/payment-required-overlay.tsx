"use client";

/**
 * Content-scoped payment-required overlay.
 */
import { PlanSelectorOverlay } from "@/components/billing/plan-selector-overlay";

export function PaymentRequiredOverlay() {
  // Keep the paywall inside the current content pane so chrome stays accessible.
  return (
    <PlanSelectorOverlay
      dismissible={false}
      currentPlan={null}
      currentInterval={null}
      hasImpact={false}
      position="absolute"
    />
  );
}
