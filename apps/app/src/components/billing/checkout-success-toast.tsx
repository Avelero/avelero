"use client";

import { sonnerToast } from "@v1/ui/sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Handles checkout return query params (?checkout=success|cancelled).
 * Shows a toast and clears the query param from the URL.
 *
 * Mount this component on the billing settings page.
 */
export function CheckoutReturnHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;

    const checkoutStatus = searchParams.get("checkout");
    if (!checkoutStatus) return;

    handledRef.current = true;

    if (checkoutStatus === "success") {
      sonnerToast.success("Payment successful! Your plan is now active.");
    } else if (checkoutStatus === "cancelled") {
      sonnerToast("Checkout was cancelled. You can try again anytime.");
    }

    // Clear the query param from URL
    router.replace("/settings/billing", { scroll: false });
  }, [searchParams, router]);

  return null;
}
