import { Button } from "@v1/ui/button";

export default function BillingPage() {
  return (
    <div className="w-full max-w-[700px]">
      <div className="rounded-xl border border-border bg-background p-6">
        <h1 className="type-large !font-semibold text-primary">Billing</h1>
        <p className="mt-2 type-small text-secondary">
          Billing management is being finalized. For plan changes, payment updates,
          or invoice support, contact our team.
        </p>

        <div className="mt-5">
          <Button asChild size="sm">
            <a href="mailto:support@avelero.com">Contact support</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
