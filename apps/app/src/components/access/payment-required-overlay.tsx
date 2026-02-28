import Link from "next/link";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";

export function PaymentRequiredOverlay() {
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-background/70 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-[460px] rounded-xl border border-border bg-background p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-destructive/10 p-2 text-destructive">
            <Icons.AlertTriangle className="h-4 w-4" />
          </div>
          <div className="space-y-2">
            <h2 className="type-large !font-semibold text-primary">
              Payment Required
            </h2>
            <p className="type-small text-secondary">
              Your trial has ended. You can continue reviewing brand data, but write
              actions are blocked until billing is updated.
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <Button asChild size="sm">
            <Link href="/settings/billing">Open Billing</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href="mailto:support@avelero.com">Contact support</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
