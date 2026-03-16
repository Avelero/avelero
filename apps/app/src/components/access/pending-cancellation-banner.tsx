import { Icons } from "@v1/ui/icons";

interface PendingCancellationBannerProps {
  accessUntil: string | null;
}

export function PendingCancellationBanner({
  accessUntil,
}: PendingCancellationBannerProps) {
  const formattedDate = accessUntil
    ? new Date(accessUntil).toLocaleDateString()
    : "the end of the current billing period";

  return (
    <div className="sticky top-0 z-30 w-full border-b border-blue-300 bg-blue-50/95 px-4 py-2 text-blue-950 backdrop-blur">
      <div className="mx-auto flex max-w-[1200px] items-center gap-2 type-small">
        <Icons.Info className="h-4 w-4 shrink-0" />
        <span>
          Your plan has been cancelled. You have access until {formattedDate}.
        </span>
      </div>
    </div>
  );
}
