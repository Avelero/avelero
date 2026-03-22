/**
 * Modal for purchasing one-time passport packs via Stripe Checkout.
 * Follows the same Dialog pattern as DeleteProductsModal, etc.
 */
"use client";

import { formatCredits, formatPrice } from "@/components/billing/plan-features";
import { PackSizeSelect } from "@/components/select/pack-size-select";
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
import { CREDIT_PACKS } from "../billing/plan-features";

interface PurchaseCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onboardingDiscountAvailable: boolean;
}

function PurchaseCreditsModal({
  open,
  onOpenChange,
  onboardingDiscountAvailable,
}: PurchaseCreditsModalProps) {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const trpc = useTRPC();
  const packCheckoutMutation = useMutation(
    trpc.brand.billing.createPackCheckout.mutationOptions({
      onSuccess: (data) => {
        window.location.href = data.url;
      },
      onError: (error) => {
        toast.error(error.message || "Failed to start checkout.");
      },
    }),
  );

  const selectedPack = selectedSize
    ? CREDIT_PACKS.find((p) => String(p.credits) === selectedSize)
    : null;
  const price = selectedPack?.price ?? 0;
  const discountedPrice = onboardingDiscountAvailable
    ? Math.round(price * 0.5)
    : price;
  const perPassport = selectedPack ? price / selectedPack.credits : 0;

  function handlePurchase() {
    if (!selectedSize) return;
    packCheckoutMutation.mutate({
      pack_size: selectedSize as
        | "100"
        | "250"
        | "500"
        | "1000"
        | "2500"
        | "5000",
    });
  }

  // Reset selection when modal closes
  function handleOpenChange(next: boolean) {
    if (!next) {
      setSelectedSize(null);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md" className="gap-0 overflow-visible p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="text-foreground">
            Purchase passports
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-secondary">
              <p className="font-medium text-foreground">
                How purchasing passports works
              </p>
              <ul className="list-disc space-y-1 pl-4 text-secondary">
                <li>Passports are added to your balance after payment</li>
                <li>
                  Credits never expire as long as your subscription is active
                </li>
                <li>
                  Want a better rate? Upgrade your plan for recurring credits
                </li>
              </ul>
            </div>
          </DialogDescription>

          {onboardingDiscountAvailable ? (
            <div className="inline-flex items-center gap-2 border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
              <Icons.CheckCircle2 className="h-4 w-4" />
              First pack 50% off — applied automatically
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Select amount
            </label>
            <PackSizeSelect
              value={selectedSize}
              onValueChange={setSelectedSize}
            />
          </div>

          {/* Price summary — only shown after selection */}
          {selectedPack ? (
            <div className="border border-border bg-accent-light/40 px-4 py-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {formatCredits(selectedPack.credits)} passports
                  </p>
                  <p className="text-xs text-secondary">
                    €
                    {perPassport.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    per passport
                  </p>
                </div>
                <div className="text-right">
                  {onboardingDiscountAvailable ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-tertiary line-through">
                        {formatPrice(price)}
                      </span>
                      <span className="text-lg font-semibold text-primary">
                        {formatPrice(discountedPrice)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-lg font-semibold text-primary">
                      {formatPrice(price)}
                    </span>
                  )}
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
            disabled={!selectedSize || packCheckoutMutation.isPending}
          >
            {packCheckoutMutation.isPending ? (
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
