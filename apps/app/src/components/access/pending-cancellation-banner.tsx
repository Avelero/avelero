"use client";

/**
 * Displays a centered info banner when a subscription is scheduled to end later.
 */
import { formatBillingDate } from "@/lib/format-billing-date";
import { Icons } from "@v1/ui/icons";

interface PendingCancellationBannerProps {
  accessUntil: string | null;
  onDismiss?: () => void;
}

export function PendingCancellationBanner({
  accessUntil,
  onDismiss,
}: PendingCancellationBannerProps) {
  // Format the access cutoff in UTC so billing banners stay consistent with billing pages.
  const formattedDate =
    formatBillingDate(accessUntil) ?? "the end of the current billing period";

  return (
    <div className="sticky top-0 z-30 flex min-h-10 w-full items-center border-b border-blue-300 bg-blue-50/95 px-4 py-2 text-blue-950 backdrop-blur sm:h-10 sm:py-0">
      <div className="mx-auto w-full max-w-[1200px]">
        <div className="flex items-start justify-center gap-2 px-8 text-center type-small sm:items-center">
          <Icons.Info className="h-4 w-4 shrink-0" />
          <span>
            Your plan has been cancelled. You have access until {formattedDate}.
          </span>
        </div>
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-[19px] top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-sm p-1 text-blue-700 transition-colors hover:bg-blue-100 hover:text-blue-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          aria-label="Dismiss banner"
        >
          <Icons.X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
