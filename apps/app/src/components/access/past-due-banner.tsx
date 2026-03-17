/**
 * Displays the billing grace-period warning banner.
 */
import Link from "next/link";
import { Icons } from "@v1/ui/icons";

export function PastDueBanner() {
  // Let the banner grow on smaller screens without clipping wrapped content.
  return (
    <div className="sticky top-0 z-30 flex min-h-10 w-full items-center border-b border-amber-300 bg-amber-100/95 px-4 py-2 text-amber-900 backdrop-blur sm:h-10 sm:py-0">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex items-start gap-2 type-small">
          <Icons.AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Payment is past due. You still have access during the 14-day grace
            period, but please resolve billing before access expires.
          </span>
        </div>
        <Link
          href="/settings/billing"
          className="type-small !font-semibold underline underline-offset-2 sm:shrink-0"
        >
          Update payment method
        </Link>
      </div>
    </div>
  );
}
