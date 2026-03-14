"use client";

import { BooleanToggle } from "@v1/ui/boolean";

interface BillingIntervalToggleProps {
  interval: "monthly" | "yearly";
  onChange: (interval: "monthly" | "yearly") => void;
}

export function BillingIntervalToggle({
  interval,
  onChange,
}: BillingIntervalToggleProps) {
  return (
    <BooleanToggle
      className="w-auto flex-none"
      value={interval === "yearly"}
      onChange={(isYearly) => onChange(isYearly ? "yearly" : "monthly")}
      leftLabel="Monthly"
      rightLabel="Yearly (save 10%)"
    />
  );
}
