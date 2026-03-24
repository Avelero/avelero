/**
 * Quantity input for tier-based passport top-ups.
 */
"use client";

import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { Input } from "@v1/ui/input";
import {
  TOPUP_QUICK_AMOUNTS,
  type PaidPlanTier,
} from "./plan-features";

interface CreditQuantityInputProps {
  tier: PaidPlanTier;
  value: number | null;
  onChange: (value: number | null) => void;
}

export function CreditQuantityInput({
  tier,
  value,
  onChange,
}: CreditQuantityInputProps) {
  const quickAmounts = TOPUP_QUICK_AMOUNTS[tier];

  function handleInputChange(rawValue: string) {
    if (rawValue.trim().length === 0) {
      onChange(null);
      return;
    }

    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsed)) {
      onChange(null);
      return;
    }

    onChange(Math.max(1, parsed));
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground" htmlFor="topup-quantity">
        Number of passports
      </label>
      <div className="grid grid-cols-3 gap-2">
        {quickAmounts.map((amount) => (
          <Button
            key={amount}
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => onChange(amount)}
          >
            <Icons.Passport className="h-4 w-4" />
            <span className="px-1">{amount.toLocaleString("en-US")}</span>
          </Button>
        ))}
      </div>
      <Input
        id="topup-quantity"
        type="number"
        min={1}
        step={1}
        inputMode="numeric"
        value={value ?? ""}
        onChange={(event) => handleInputChange(event.target.value)}
        placeholder="Enter a quantity"
      />
    </div>
  );
}
