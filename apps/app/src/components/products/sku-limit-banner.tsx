/**
 * SKU limit warning and blocked-state banner for the passports list page.
 */
import Link from "next/link";
import { Icons } from "@v1/ui/icons";

interface SkuBudget {
  limit: number | null;
  used: number;
  remaining: number | null;
  utilization: number | null;
}

interface SkuLimitBannerProps {
  sku: {
    status: "allowed" | "warning" | "blocked";
    annual: SkuBudget;
    onboarding: SkuBudget;
  };
}

/**
 * Selects the finite SKU budget that is currently closest to its limit.
 */
function getDisplayedBudget(sku: SkuLimitBannerProps["sku"]): {
  kind: "annual" | "onboarding";
  budget: SkuBudget;
} | null {
  const candidates = [
    { kind: "annual" as const, budget: sku.annual },
    { kind: "onboarding" as const, budget: sku.onboarding },
  ].filter((candidate) => candidate.budget.limit !== null);

  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort(
    (left, right) =>
      (right.budget.utilization ?? 0) - (left.budget.utilization ?? 0),
  )[0]!;
}

/**
 * Formats SKU counts consistently across banner states.
 */
function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

export function SkuLimitBanner({ sku }: SkuLimitBannerProps) {
  if (sku.status === "allowed") {
    return null;
  }

  const displayedBudget = getDisplayedBudget(sku);
  if (!displayedBudget) {
    return null;
  }

  const isBlocked = sku.status === "blocked";
  const isAnnualBudget = displayedBudget.kind === "annual";
  const toneClasses = isBlocked
    ? "border-destructive/30 bg-destructive/10 text-destructive"
    : "border-amber-300 bg-amber-50 text-amber-900";
  const ctaLabel = isBlocked ? "Upgrade plan" : "View plans";
  const periodLabel = isAnnualBudget ? "this year" : "during onboarding";
  const message = isBlocked
    ? `You've reached your plan's SKU limit (${formatCount(displayedBudget.budget.used)}/${formatCount(displayedBudget.budget.limit!)} SKUs used). Upgrade your plan to add more products.`
    : `You've used ${formatCount(displayedBudget.budget.used)} of ${formatCount(displayedBudget.budget.limit!)} new SKUs ${periodLabel}. Consider upgrading your plan before you hit the limit.`;

  return (
    <div className={`border p-4 ${toneClasses}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <Icons.AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="type-small">{message}</p>
        </div>
        <Link
          href="/settings/billing"
          className="type-small !font-semibold underline underline-offset-2"
          prefetch
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
