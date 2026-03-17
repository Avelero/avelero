/**
 * Displays the billing grace-period warning banner.
 */
import Link from "next/link";
import { Icons } from "@v1/ui/icons";

export function PastDueBanner() {
  // Keep the banner height stable so fixed dashboard chrome can offset cleanly.
  return (
    <div className="sticky top-0 z-30 flex h-10 w-full items-center border-b border-amber-300 bg-amber-100/95 px-4 text-amber-900 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-3">
        <div className="flex items-center gap-2 type-small">
          <Icons.AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Payment is past due. You still have access during the 14-day grace
            period, but please resolve billing before access expires.
          </span>
        </div>
        <Link
          href="/settings/billing"
          className="shrink-0 type-small !font-semibold underline underline-offset-2"
        >
          Update payment method
        </Link>
      </div>
    </div>
  );
}
