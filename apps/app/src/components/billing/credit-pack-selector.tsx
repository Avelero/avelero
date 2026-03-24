/**
 * Button that opens the quantity-based top-up purchase modal.
 */
"use client";

import { PurchaseCreditsModal } from "@/components/modals/purchase-credits-modal";
import { Button } from "@v1/ui/button";
import { useState } from "react";
import type { PaidPlanTier } from "./plan-features";

interface CreditPackSelectorProps {
  tier: PaidPlanTier;
  onboardingDiscountAvailable: boolean;
}

export function CreditPackSelector({
  tier,
  onboardingDiscountAvailable,
}: CreditPackSelectorProps) {
  // Keep the modal mounted locally so billing pages can open it without extra route state.
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Buy additional passports
      </Button>
      <PurchaseCreditsModal
        open={open}
        onOpenChange={setOpen}
        tier={tier}
        onboardingDiscountAvailable={onboardingDiscountAvailable}
      />
    </>
  );
}
