import Link from "next/link";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";

type BlockedAccessReason = "suspended" | "cancelled";

const CONTENT: Record<
  BlockedAccessReason,
  { title: string; description: string }
> = {
  suspended: {
    title: "Brand Access Suspended",
    description:
      "This brand is currently suspended. Contact support to review and restore access.",
  },
  cancelled: {
    title: "Brand Access Cancelled",
    description:
      "This brand is cancelled and currently blocked. Contact support if you need to reactivate it.",
  },
};

export function BlockedAccessScreen({ reason }: { reason: BlockedAccessReason }) {
  const content = CONTENT[reason];

  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center p-8">
      <div className="w-full max-w-[520px] rounded-2xl border border-border bg-background p-8 shadow-sm">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <Icons.Lock className="h-5 w-5" />
        </div>

        <div className="space-y-2 text-center">
          <h1 className="type-large !font-semibold text-primary">
            {content.title}
          </h1>
          <p className="type-small text-secondary">{content.description}</p>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2">
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
