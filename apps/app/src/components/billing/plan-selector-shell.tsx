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
    />
  );
}
