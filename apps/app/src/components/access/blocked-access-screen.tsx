"use client";

import { usePlanSelector } from "@/components/billing/plan-selector-context";
import { DeleteBrandModal } from "@/components/modals/delete-brand-modal";
import { Button } from "@v1/ui/button";
import { usePathname } from "next/navigation";
import { useState } from "react";

type BlockedAccessReason =
  | "suspended"
  | "temporary_blocked"
  | "cancelled"
  | "trial_expired";

const EXEMPT_PATHS = ["/account", "/account/brands"];

const CONTENT: Record<
  BlockedAccessReason,
  { title: string; description: string; showPlans: boolean }
> = {
  suspended: {
    title: "Brand Suspended",
    description: "Your brand has been suspended. Please contact support.",
    showPlans: false,
  },
  temporary_blocked: {
    title: "Brand Temporarily Blocked",
    description:
      "Your brand has been temporarily blocked. Please contact support to restore access.",
    showPlans: false,
  },
  cancelled: {
    title: "Subscription Cancelled",
    description:
      "Your subscription has been cancelled. Please resubscribe to reactivate your brand.",
    showPlans: true,
  },
  trial_expired: {
    title: "Trial Ended",
    description: "Your trial has ended. Please select a plan to continue.",
    showPlans: true,
  },
};

export function BlockedAccessScreen({
  reason,
  brandId,
}: { reason: BlockedAccessReason; brandId: string }) {
  const content = CONTENT[reason];
  const pathname = usePathname();
  const { open: openPlanSelector } = usePlanSelector();
  const [showDeleteBrand, setShowDeleteBrand] = useState(false);

  // Don't show overlay on exempt pages (account management)
  if (EXEMPT_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return null;
  }

  return (
    <>
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-background">
        <div className="w-full max-w-[400px] px-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <h2 className="!type-h5 text-primary">{content.title}</h2>
              <p className="!type-p text-secondary">{content.description}</p>
            </div>

            <div className="flex flex-col gap-3">
              {content.showPlans ? (
                <Button
                  type="button"
                  className="w-full"
                  onClick={openPlanSelector}
                >
                  View Plans
                </Button>
              ) : null}

              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setShowDeleteBrand(true)}
                  className="type-small text-secondary underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  Delete brand
                </button>
                <a
                  href="mailto:raf@avelero.com"
                  className="type-small text-secondary underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  Contact support
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DeleteBrandModal
        open={showDeleteBrand}
        onOpenChange={setShowDeleteBrand}
        brandId={brandId}
      />
    </>
  );
}
