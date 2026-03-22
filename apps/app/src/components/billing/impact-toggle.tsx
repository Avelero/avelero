"use client";

/**
 * Impact Predictions add-on toggle for plan selection surfaces.
 */
import { cn } from "@v1/ui/cn";
import {
  PLAN_DISPLAY,
  formatPrice,
  getEffectiveMonthlyPrice,
  type PlanTier,
} from "./plan-features";

interface ImpactToggleProps {
  tier: Exclude<PlanTier, "enterprise">;
  interval: "quarterly" | "yearly";
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function ImpactToggle({
  tier,
  interval,
  checked,
  onChange,
  disabled,
}: ImpactToggleProps) {
  const display = PLAN_DISPLAY[tier];
  const billedAmount =
    interval === "quarterly"
      ? display.impactQuarterlyPrice
      : display.impactYearlyPrice;
  const monthlyEquivalent =
    interval === "quarterly"
      ? display.impactMonthlyPrice
      : display.impactYearlyPrice != null
        ? getEffectiveMonthlyPrice(display.impactYearlyPrice)
        : null;

  if (billedAmount == null || monthlyEquivalent == null) return null;

  const priceLabel =
    interval === "quarterly"
      ? `+${formatPrice(monthlyEquivalent)}/mo, billed quarterly`
      : `+${formatPrice(monthlyEquivalent)}/mo equivalent`;

  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
        checked
          ? "border-primary/30 bg-primary/5"
          : "border-border hover:border-border/80",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
      />
      <div className="flex-1 space-y-0.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-primary">
            Impact Predictions
          </span>
          <span className="text-sm font-medium text-secondary">
            {priceLabel}
          </span>
        </div>
        <p className="text-xs text-secondary">
          AI-powered CO2 & water impact estimates per SKU. Charged{" "}
          {formatPrice(billedAmount)}{" "}
          {interval === "quarterly" ? "quarterly" : "yearly"}.
        </p>
      </div>
    </label>
  );
}
