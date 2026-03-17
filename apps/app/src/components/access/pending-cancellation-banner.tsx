/**
 * Displays a centered info banner when a subscription is scheduled to end later.
 */
import { Icons } from "@v1/ui/icons";

interface PendingCancellationBannerProps {
  accessUntil: string | null;
}

export function PendingCancellationBanner({
  accessUntil,
}: PendingCancellationBannerProps) {
  // Keep the banner height stable so the dashboard chrome can offset fixed elements.
  const formattedDate = accessUntil
    ? new Date(accessUntil).toLocaleDateString()
    : "the end of the current billing period";

  return (
    <div className="sticky top-0 z-30 flex h-10 w-full items-center border-b border-blue-300 bg-blue-50/95 px-4 text-blue-950 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-center gap-2 text-center type-small">
        <Icons.Info className="h-4 w-4 shrink-0" />
        <span>
          Your plan has been cancelled. You have access until {formattedDate}.
        </span>
      </div>
    </div>
  );
}
