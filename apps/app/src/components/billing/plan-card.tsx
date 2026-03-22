"use client";

/**
 * Displays a single selectable plan card inside the billing selector.
 */
import { cn } from "@v1/ui/cn";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import {
  PLAN_DISPLAY,
  getPlanFeatures,
  getEffectiveMonthlyPrice,
  type PlanTier,
} from "./plan-features";
import { RollingPrice } from "./rolling-price";

interface PlanCardProps {
  tier: PlanTier;
  interval: "quarterly" | "yearly";
  onSelect: (tier: PlanTier) => void;
  isCurrentPlan?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  currentPlanActionLabel?: string;
  onCurrentPlanSelect?: () => void;
}

export function PlanCard({
  // Render the current plan differently so renew and change-plan states stay clear.
  tier,
  interval,
  onSelect,
  isCurrentPlan,
  isLoading,
  disabled,
  currentPlanActionLabel,
  onCurrentPlanSelect,
}: PlanCardProps) {
  const display = PLAN_DISPLAY[tier];

  const price =
    interval === "yearly" && display.yearlyPrice != null
      ? getEffectiveMonthlyPrice(display.yearlyPrice)
      : display.monthlyPrice;
  const periodLabel =
    interval === "yearly"
      ? "/month, billed yearly"
      : "/month, billed quarterly";
  return (
    <div
      className={cn(
        "relative flex flex-col border p-5",
        isCurrentPlan
          ? "border-primary/40 bg-primary/[0.02]"
          : "border-border bg-background",
      )}
    >
      <div>
        <h3 className="text-lg font-semibold text-primary">{display.name}</h3>
        <p className="mt-1 text-sm text-secondary">{display.description}</p>
      </div>

      <div className="mt-4 flex items-baseline gap-1">
        <RollingPrice
          value={price ?? 0}
          className="text-2xl font-bold text-primary"
        />
        <span className="text-sm text-secondary">{periodLabel}</span>
      </div>

      <div className="mt-4">
        {isCurrentPlan ? (
          onCurrentPlanSelect ? (
            <Button
              variant="outline"
              className="w-full"
              disabled={disabled || isLoading}
              onClick={onCurrentPlanSelect}
            >
              {isLoading ? (
                <Icons.Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                currentPlanActionLabel
              )}
            </Button>
          ) : (
            <Button variant="outline" className="w-full" disabled>
              Current plan
            </Button>
          )
        ) : (
          <Button
            className="w-full"
            disabled={disabled || isLoading}
            onClick={() => onSelect(tier)}
          >
            {isLoading ? (
              <Icons.Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              `Select ${display.name}`
            )}
          </Button>
        )}
      </div>

      <ul className="mt-5 flex-1 space-y-2">
        {getPlanFeatures(interval).map((feature) => {
          const value = feature[tier];
          const isIncluded = value === true || typeof value === "string";

          return (
            <li key={feature.label} className="flex items-start gap-2">
              {isIncluded ? (
                <Icons.Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              ) : (
                <Icons.Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-tertiary" />
              )}
              <span
                className={cn(
                  "text-sm",
                  isIncluded ? "text-primary" : "text-tertiary",
                )}
              >
                {typeof value === "string"
                  ? `${value} ${value === "1" && feature.label.endsWith("s") ? feature.label.slice(0, -1).toLowerCase() : feature.label.toLowerCase()}`
                  : feature.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
