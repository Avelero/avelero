"use client";

import { PlanSelectorOverlay } from "@/components/billing/plan-selector-overlay";

export function PaymentRequiredOverlay() {
  return (
    <PlanSelectorOverlay
      dismissible={false}
      currentPlan={null}
      currentInterval={null}
      hasImpact={false}
    />
  );
}
