/**
 * Publish-limit warning and blocked-state banner for passport surfaces.
 */
import Link from "next/link";
import { Icons } from "@v1/ui/icons";

interface SkuBudget {
  kind: "trial" | "onboarding" | "annual" | null;
  phase: "demo" | "trial" | "onboarding" | "annual" | "none";
  limit: number | null;
  used: number;
  remaining: number | null;
  utilization: number | null;
  windowStartAt: string | null;
  windowEndAt: string | null;
  isFirstPaidYear: boolean;
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
 * Maps the active budget kind to the publish-limit banner copy.
 */
function getBudgetCopy(budget: SkuBudget) {
  if (budget.kind === "trial") {
    return {
      blocked:
        "You've reached your 50-passport trial publish limit. Subscribe to continue publishing passports.",
      warning: `You've published ${formatCount(budget.used)} of ${formatCount(budget.limit!)} trial passports. Subscribe before you hit the trial limit.`,
      ctaLabel: "View plans",
    };
  }

  if (budget.kind === "onboarding") {
    return {
      blocked: `You've reached your first-year onboarding passport publish limit (${formatCount(budget.used)}/${formatCount(budget.limit!)} passports published). Upgrade your plan to publish more passports.`,
      warning: `You've published ${formatCount(budget.used)} of ${formatCount(budget.limit!)} onboarding passports. Consider upgrading before you hit the limit.`,
      ctaLabel: "View plans",
    };
  }

  return {
    blocked: `You've reached your yearly passport publish limit (${formatCount(budget.used)}/${formatCount(budget.limit!)} passports published). Upgrade your plan to publish more passports.`,
    warning: `You've published ${formatCount(budget.used)} of ${formatCount(budget.limit!)} passports in this window. Consider upgrading before you hit the limit.`,
    ctaLabel: "View plans",
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
  const ctaLabel = isBlocked ? "Upgrade plan" : copy.ctaLabel;
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
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
