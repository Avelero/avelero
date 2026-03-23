/**
 * Renders credit usage for the active brand using billing status data.
 */
"use client";

import { PurchaseCreditsModal } from "@/components/modals/purchase-credits-modal";
import { SkuLimitBanner } from "@/components/products/sku-limit-banner";
import { useTRPC } from "@/trpc/client";
import { Skeleton } from "@v1/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { CreditBalanceCard } from "./credit-balance-card";
import { CreditPackSelector } from "./credit-pack-selector";
import { PLAN_DISPLAY, type PaidPlanTier, type PlanTier } from "./plan-features";

/**
 * Renders the credit balance overview for the brand.
 */
export function UsagePageContent() {
  const trpc = useTRPC();
  const statusQuery = useQuery(trpc.brand.billing.getStatus.queryOptions());
  const status = statusQuery.data;

  if (!status) {
    return (
      <div className="w-full max-w-[700px] space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="border border-border p-5">
          <div className="flex gap-10">
            <div className="space-y-1">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-16" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-7 w-12" />
            </div>
          </div>
          <div className="mt-5 border-t border-border pt-4 space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3.5 w-16" />
            </div>
            <Skeleton className="h-2.5 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const totalCredits = status.total_credits ?? 0;
  const publishedCount = status.published_count ?? 0;
  const remainingCredits = status.remaining_credits ?? 0;
  const utilization = status.utilization;
  const topupTier =
    status.plan_type && status.plan_type !== "enterprise"
      ? (status.plan_type as PaidPlanTier)
      : null;
  const showTopupPurchases =
    status.phase === "active" &&
    status.billing_mode === "stripe_checkout" &&
    status.has_active_subscription &&
    !!topupTier;

  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const handleBuyCredits = useCallback(() => setPurchaseModalOpen(true), []);

  if (totalCredits <= 0) {
    return (
      <div className="w-full max-w-[700px]">
        <h4 className="type-h5 text-foreground">Credit usage</h4>
        <p className="mt-1 text-sm text-secondary">
          Credit information is not available for this brand yet.
        </p>
      </div>
    );
  }

  const description =
    status.phase === "demo" || status.phase === "trial"
      ? "You have 50 free credits to get started. These carry forward when you subscribe."
      : "Your credit balance determines how many passports you can have published at once.";

  // Derive SKU status for the limit banner from billing data.
  const skuStatus: "allowed" | "warning" | "blocked" =
    remainingCredits !== null && remainingCredits <= 0
      ? "blocked"
      : utilization !== null && utilization >= 0.8
        ? "warning"
        : "allowed";

  return (
    <div className="w-full max-w-[700px] space-y-6">
      <SkuLimitBanner
        sku={{
          status: skuStatus,
          activeBudget: {
            kind: "credits",
            phase: status.phase as
              | "demo"
              | "trial"
              | "expired"
              | "active"
              | "past_due"
              | "suspended"
              | "cancelled"
              | "none",
            limit: totalCredits,
            used: publishedCount,
            remaining: remainingCredits,
            utilization,
          },
        }}
        onAction={showTopupPurchases ? handleBuyCredits : undefined}
      />
      {showTopupPurchases && topupTier && (
        <PurchaseCreditsModal
          open={purchaseModalOpen}
          onOpenChange={setPurchaseModalOpen}
          tier={topupTier}
          onboardingDiscountAvailable={!status.onboarding_discount_used}
        />
      )}
      <CreditBalanceCard
        description={description}
        totalCredits={totalCredits}
        publishedCount={publishedCount}
        remainingCredits={remainingCredits}
        utilization={utilization}
        nextRenewalAt={
          status.has_active_subscription && !status.pending_cancellation
            ? status.current_period_end
            : null
        }
        nextCreditGrant={deriveNextCreditGrant(
          status.plan_type as PlanTier | null,
          status.billing_interval as "quarterly" | "yearly" | null,
        )}
        action={
          showTopupPurchases ? (
            <CreditPackSelector
              tier={topupTier!}
              onboardingDiscountAvailable={!status.onboarding_discount_used}
            />
          ) : undefined
        }
      />
    </div>
  );
}

/**
 * Map the current plan cadence to the next recurring credit grant amount.
 */
function deriveNextCreditGrant(
  planType: PlanTier | null,
  billingInterval: "quarterly" | "yearly" | null,
): number | null {
  if (!planType || !billingInterval) return null;
  const display = PLAN_DISPLAY[planType];
  if (!display) return null;
  if (billingInterval === "quarterly") return display.creditsPerQuarter;
  if (billingInterval === "yearly") return display.creditsPerYear;
  return null;
}
