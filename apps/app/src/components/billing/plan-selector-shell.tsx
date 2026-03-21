/**
 * Mounts the shared plan-selector overlay and hydrates it from billing state.
 */
"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { PlanSelectorProvider, usePlanSelector } from "./plan-selector-context";
import { PlanSelectorOverlay } from "./plan-selector-overlay";

/**
 * Wraps children with the PlanSelectorProvider and renders the overlay
 * when open. Place this in the sidebar layout so both the sidebar trial
 * button and the payment-required overlay can trigger it.
 */
export function PlanSelectorShell({ children }: { children: ReactNode }) {
  return (
    <PlanSelectorProvider>
      {children}
      <PlanSelectorOverlayRenderer />
    </PlanSelectorProvider>
  );
}

/** Reads context + billing state, renders overlay when open. */
function PlanSelectorOverlayRenderer() {
  // Load billing status only while the overlay is open to keep the shell lightweight.
  const { isOpen, close } = usePlanSelector();
  const trpc = useTRPC();
  const statusQuery = useQuery({
    ...trpc.brand.billing.getStatus.queryOptions(),
    enabled: isOpen,
  });

  if (!isOpen) return null;

  const status = statusQuery.data;

  return (
    <PlanSelectorOverlay
      dismissible
      onClose={close}
      currentPlan={
        status?.plan_type as "starter" | "growth" | "scale" | null ?? null
      }
      currentInterval={
        status?.billing_interval as "monthly" | "yearly" | null ?? null
      }
      hasImpact={status?.has_impact_predictions ?? false}
      hasSubscription={status?.has_active_subscription ?? false}
      pendingCancellation={status?.pending_cancellation ?? false}
      periodStart={status?.current_period_start ?? null}
      periodEnd={status?.current_period_end ?? null}
    />
  );
}
