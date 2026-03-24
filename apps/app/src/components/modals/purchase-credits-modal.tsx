/**
 * Modal for purchasing quantity-based passport top-ups via Stripe Checkout.
 */
"use client";

import { CreditQuantityInput } from "@/components/billing/credit-quantity-input";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Icons } from "@v1/ui/icons";
import { toast } from "@v1/ui/sonner";
import { useState } from "react";
import {
  ONBOARDING_DISCOUNT_CAP,
  TOPUP_RATES,
  formatCredits,
  formatPrice,
  type PaidPlanTier,
} from "../billing/plan-features";

interface PurchaseCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tier: PaidPlanTier;
  onboardingDiscountAvailable: boolean;
}

function PurchaseCreditsModal({
  open,
  onOpenChange,
  tier,
  onboardingDiscountAvailable,
}: PurchaseCreditsModalProps) {
  const [quantity, setQuantity] = useState<number | null>(null);

  const trpc = useTRPC();
  const topupCheckoutMutation = useMutation(
    trpc.brand.billing.createTopupCheckout.mutationOptions({
      onSuccess: (data) => {
        window.location.href = data.url;
      },
      onError: (error) => {
        toast.error(error.message || "Failed to start checkout.");
      },
    }),
  );

  const rate = TOPUP_RATES[tier];
  const discountCap = ONBOARDING_DISCOUNT_CAP[tier];
  const hasDiscount = onboardingDiscountAvailable && !!quantity;
  const discountedQuantity = hasDiscount ? Math.min(quantity, discountCap) : 0;
  const fullPriceQuantity = hasDiscount ? Math.max(0, quantity - discountCap) : (quantity ?? 0);
  const discountedSubtotal = discountedQuantity * rate * 0.5;
  const fullPriceSubtotal = fullPriceQuantity * rate;
  const totalDue = hasDiscount
    ? discountedSubtotal + fullPriceSubtotal
    : (quantity ?? 0) * rate;
  const totalBeforeDiscount = (quantity ?? 0) * rate;

  function handlePurchase() {
    if (!quantity) return;
    topupCheckoutMutation.mutate({ quantity });
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setQuantity(null);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md" className="gap-0 overflow-visible p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="text-foreground">
            Purchase additional passports
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-secondary">
              <p className="font-medium text-foreground">
                How purchasing passports works
              </p>
              <ul className="list-disc space-y-1 pl-4">
                <li>Each purchased passport adds one credit to your balance</li>
                <li>Credits are added after payment and can be used immediately</li>
                <li>Want a better rate? Upgrade your plan for more included passports</li>
              </ul>
            </div>
          </DialogDescription>

          {onboardingDiscountAvailable ? (
            <div className="flex items-center gap-2 border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
              <Icons.CheckCircle2 className="h-4 w-4 shrink-0" />
              First purchase 50% off — up to {formatCredits(discountCap)} passports
            </div>
          ) : null}

          <CreditQuantityInput
            tier={tier}
            value={quantity}
            onChange={setQuantity}
          />

          {quantity && quantity > 0 ? (
            <div className="space-y-2">
              {hasDiscount ? (
                <>
                  <div className="flex justify-between text-sm text-secondary">
                    <span>{formatCredits(discountedQuantity)} passports at 50% off</span>
                    <span>{formatPrice(discountedSubtotal)}</span>
                  </div>
                  {fullPriceQuantity > 0 ? (
                    <div className="flex justify-between text-sm text-secondary">
                      <span>{formatCredits(fullPriceQuantity)} passports at €{rate.toFixed(2)}</span>
                      <span>{formatPrice(fullPriceSubtotal)}</span>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="flex justify-between text-sm text-secondary">
                  <span>{formatCredits(quantity)} passports at €{rate.toFixed(2)}</span>
                  <span>{formatPrice(totalDue)}</span>
                </div>
              )}

              <div className="flex items-baseline justify-between border-t border-border pt-2">
                <span className="text-sm font-medium text-foreground">
                  Due today
                </span>
                <div className="flex items-baseline gap-2">
                  {hasDiscount && totalBeforeDiscount !== totalDue ? (
                    <span className="text-sm text-tertiary line-through">
                      {formatPrice(totalBeforeDiscount)}
                    </span>
                  ) : null}
                  <span className="text-lg font-semibold text-primary">
                    {formatPrice(totalDue)}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button variant="outline" asChild>
            <a href="/settings/billing">Upgrade plan</a>
          </Button>
          <Button
            type="button"
            onClick={handlePurchase}
            disabled={!quantity || topupCheckoutMutation.isPending}
          >
            {topupCheckoutMutation.isPending ? (
              <>
                <Icons.Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting...
              </>
            ) : (
              "Purchase passports"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { PurchaseCreditsModal };
