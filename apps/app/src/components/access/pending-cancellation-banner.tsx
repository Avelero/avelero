/**
 * Displays a centered info banner when a subscription is scheduled to end later.
 */
import { formatBillingDate } from "@/lib/format-billing-date";
import { Icons } from "@v1/ui/icons";

interface PendingCancellationBannerProps {
  accessUntil: string | null;
}

export function PendingCancellationBanner({
  accessUntil,
}: PendingCancellationBannerProps) {
  // Format the access cutoff in UTC so billing banners stay consistent with billing pages.
  const formattedDate =
    formatBillingDate(accessUntil) ?? "the end of the current billing period";

  return (
    <div className="sticky top-0 z-30 flex min-h-10 w-full items-center border-b border-blue-300 bg-blue-50/95 px-4 py-2 text-blue-950 backdrop-blur sm:h-10 sm:py-0">
      <div className="mx-auto flex w-full max-w-[1200px] items-start justify-center gap-2 text-center type-small">
        <Icons.Info className="h-4 w-4 shrink-0" />
        <span>
          Your plan has been cancelled. You have access until {formattedDate}.
        </span>
      </div>
    </div>
  );
}
