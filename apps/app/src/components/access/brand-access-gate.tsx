"use client";

import {
  isAllowedPathWhileBlocked,
  isBillingBlockedDecision,
  isNonBillingBlockedDecision,
} from "@/lib/access/brand-access-policy";
import { Button } from "@v1/ui/button";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@v1/api/src/trpc/routers/_app";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type BrandAccessPayload = RouterOutputs["composite"]["initDashboard"]["brandAccess"];

function formatPlanName(planType: string | null) {
  if (!planType) return "Not selected";

  return planType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatCurrencyAmount(currency: string, cents: number | null) {
  if (cents == null) return "Custom pricing";

  const amount = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

function getBillingStateMessage(code: BrandAccessPayload["decision"]["code"]) {
  if (code === "blocked_past_due") {
    return "Your billing is past due. Product features are locked until payment is restored.";
  }

  if (code === "blocked_canceled") {
    return "Your subscription is canceled. Product features are locked until billing is reactivated.";
  }

  return "Your brand is qualified but billing is not active yet. Product features are locked until payment is completed.";
}

function getNonBillingMessage(code: BrandAccessPayload["decision"]["code"]) {
  if (code === "blocked_suspended") {
    return "This brand is currently suspended. Product features are unavailable.";
  }

  if (code === "blocked_rejected") {
    return "This brand did not pass qualification. Product features are unavailable.";
  }

  if (code === "blocked_temp_blocked") {
    return "Access has been temporarily blocked by an administrator.";
  }

  return "This brand is still pending qualification. Product features are unavailable.";
}

interface BrandAccessGateViewProps {
  brandAccess: BrandAccessPayload;
  pathname: string;
  children: ReactNode;
}

export function BrandAccessGateView({
  brandAccess,
  pathname,
  children,
}: BrandAccessGateViewProps) {
  const decisionCode = brandAccess.decision.code;
  const routeAllowed = isAllowedPathWhileBlocked(pathname);

  if (routeAllowed) {
    return <>{children}</>;
  }

  if (isBillingBlockedDecision(decisionCode)) {
    const snapshot = brandAccess.controlSnapshot;
    const billingStatus = snapshot?.billingStatus ?? "pending_payment";
    const planCurrency = snapshot?.planCurrency ?? "EUR";
    const customPrice = snapshot?.customMonthlyPriceCents ?? null;

    return (
      <>
        {children}
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4"
          role="dialog"
          aria-modal="true"
          data-testid="billing-blocked-modal"
        >
          <div className="w-full max-w-[560px] border border-border bg-background p-6 space-y-5 shadow-2xl">
            <div className="space-y-2">
              <h6 className="text-foreground">Complete billing to continue</h6>
              <p className="text-secondary">{getBillingStateMessage(decisionCode)}</p>
            </div>

            <div className="border border-border p-4 space-y-2">
              <p className="type-small text-secondary">Plan overview</p>
              <div className="space-y-1">
                <p className="text-foreground">
                  Plan: {formatPlanName(snapshot?.planType ?? null)}
                </p>
                <p className="text-foreground">
                  Billing status: {billingStatus.replace("_", " ")}
                </p>
                <p className="text-foreground">
                  Price: {formatCurrencyAmount(planCurrency, customPrice)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled>
                Payment link coming soon
              </Button>
              <Button asChild variant="outline">
                <a href="/settings">Brand settings</a>
              </Button>
              <Button asChild variant="outline">
                <a href="/account">Account settings</a>
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (isNonBillingBlockedDecision(decisionCode)) {
    return (
      <>
        {children}
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-background px-4"
          data-testid="non-billing-block-screen"
        >
          <div className="w-full max-w-[720px] border border-border p-8 space-y-6">
            <div className="space-y-2">
              <h5 className="text-foreground">Access unavailable</h5>
              <p className="text-secondary">{getNonBillingMessage(decisionCode)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <a href="/settings">Brand settings</a>
              </Button>
              <Button asChild variant="outline">
                <a href="/account">Account settings</a>
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return <>{children}</>;
}

interface BrandAccessGateProps {
  brandAccess: BrandAccessPayload;
  children: ReactNode;
}

export function BrandAccessGate({ brandAccess, children }: BrandAccessGateProps) {
  const pathname = usePathname() ?? "/";

  return (
    <BrandAccessGateView pathname={pathname} brandAccess={brandAccess}>
      {children}
    </BrandAccessGateView>
  );
}

