/**
 * Button that opens the purchase credits modal.
 * Used on the usage page to let active subscribers buy one-time credit packs.
 */
"use client";

import { PurchaseCreditsModal } from "@/components/modals/purchase-credits-modal";
import { Button } from "@v1/ui/button";
import { useState } from "react";

interface CreditPackSelectorProps {
  onboardingDiscountAvailable: boolean;
}

export function CreditPackSelector({
  onboardingDiscountAvailable,
}: CreditPackSelectorProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Buy additional credits
      </Button>
      <PurchaseCreditsModal
        open={open}
        onOpenChange={setOpen}
        onboardingDiscountAvailable={onboardingDiscountAvailable}
      />
    </>
  );
}
