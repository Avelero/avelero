import Link from "next/link";
import { Icons } from "@v1/ui/icons";

export function PastDueBanner() {
  return (
    <div className="sticky top-0 z-30 w-full border-b border-amber-300 bg-amber-100/95 px-4 py-2 text-amber-900 backdrop-blur">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3">
        <div className="flex items-center gap-2 type-small">
          <Icons.AlertTriangle className="h-4 w-4" />
          <span>
            Billing is past due. Brand data is read-only until payment is resolved.
          </span>
        </div>
        <Link
          href="/settings/billing"
          className="type-small !font-semibold underline underline-offset-2"
        >
          Review billing
        </Link>
      </div>
    </div>
  );
}
