/**
 * Publish-limit warning and blocked-state banner for passport surfaces.
 */
import Link from "next/link";
import { Icons } from "@v1/ui/icons";

interface SkuBudget {
  kind: "credits" | null;
  phase:
    | "demo"
    | "trial"
    | "expired"
    | "active"
    | "past_due"
    | "suspended"
    | "cancelled"
    | "none";
  limit: number | null;
  used: number;
  remaining: number | null;
  utilization: number | null;
}

interface SkuLimitBannerProps {
  sku: {
    status: "allowed" | "warning" | "blocked";
    activeBudget: SkuBudget;
  };
}

/**
 * Formats publish counts consistently across banner states.
 */
function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

/**
 * Maps the active credit budget to the publish-limit banner copy.
 */
function getBudgetCopy(budget: SkuBudget) {
  if (budget.phase === "demo" || budget.phase === "trial") {
    return {
      blocked: `You've reached your credit limit. ${formatCount(budget.used)} of ${formatCount(budget.limit!)} credits are already in use. Subscribe to continue publishing passports.`,
      warning: `You're approaching your credit limit. ${formatCount(budget.used)} of ${formatCount(budget.limit!)} credits are already in use.`,
      ctaLabel: "Subscribe",
    };
  }

  return {
    blocked: `You've reached your credit limit. ${formatCount(budget.used)} of ${formatCount(budget.limit!)} credits are already in use. Purchase more credits or upgrade your plan to publish more passports.`,
    warning: `You're approaching your credit limit. ${formatCount(budget.used)} of ${formatCount(budget.limit!)} credits are already in use.`,
    ctaLabel: "Buy credits",
  };
}

export function SkuLimitBanner({ sku }: SkuLimitBannerProps) {
  if (sku.status === "allowed") {
    return null;
  }

  if (!sku.activeBudget.kind || sku.activeBudget.limit == null) {
    return null;
  }

  const isBlocked = sku.status === "blocked";
  const copy = getBudgetCopy(sku.activeBudget);
  const toneClasses = isBlocked
    ? "border-destructive/30 bg-destructive/10 text-destructive"
    : "border-amber-300 bg-amber-50 text-amber-900";
  const message = isBlocked ? copy.blocked : copy.warning;

  return (
    <div className={`border p-4 ${toneClasses}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <Icons.AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="type-small">{message}</p>
        </div>
        <Link
          href="/settings/billing"
          className="type-small !font-semibold underline underline-offset-2 shrink-0 whitespace-nowrap"
          prefetch
        >
          {copy.ctaLabel}
        </Link>
      </div>
    </div>
  );
}
