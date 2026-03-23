/**
 * Handles Stripe checkout return toasts on the billing page.
 */
"use client";

import { toast } from "@v1/ui/sonner";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Handles checkout return query params (?checkout=success|cancelled&topup=500).
 * Shows a toast and clears the query param from the URL.
 *
 * Mount this component on the billing settings page.
 */
export function CheckoutReturnHandler() {
  // Show the shared application toast style once per checkout redirect.
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;

    const checkoutStatus = searchParams.get("checkout");
    const topupQuantity = searchParams.get("topup");
    if (!checkoutStatus) return;

    handledRef.current = true;

    if (checkoutStatus === "success") {
      const parsedTopupQuantity = parseTopupQuantity(topupQuantity);

      if (parsedTopupQuantity !== null) {
        toast.success(
          `${parsedTopupQuantity.toLocaleString("en-US")} credits will be added to your account shortly.`,
        );
      } else {
        toast.success("Payment successful! Your plan is now active.");
      }
    } else if (checkoutStatus === "cancelled") {
      toast.error("Checkout was cancelled. You can try again anytime.");
    }

    // Clear only the billing return flags so unrelated filters survive the redirect.
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("checkout");
    nextParams.delete("topup");
    const nextUrl = nextParams.size > 0
      ? `${pathname}?${nextParams.toString()}`
      : pathname;

    router.replace(nextUrl, { scroll: false });
  }, [pathname, router, searchParams]);

  return null;
}

/**
 * Parses the returned top-up quantity from the billing success URL.
 */
function parseTopupQuantity(value: string | null): number | null {
  // Reject malformed query values so the success toast never renders NaN.
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}
