"use client";

import {
  type CustomDomainStatus,
  useCustomDomainQuery,
} from "@/hooks/use-custom-domain";
import { useUserBrandsQuery } from "@/hooks/use-brand";
import { type CurrentUser, useUserQuery } from "@/hooks/use-user";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { useState } from "react";
import { CustomDomainModal } from "../modals/custom-domain-modal";

interface Brand {
  id: string;
  name: string;
  role: "owner" | "member";
}

/**
 * Status badge for custom domain verification state.
 */
function DomainStatusBadge({ status }: { status: CustomDomainStatus }) {
  const config: Record<
    CustomDomainStatus,
    { label: string; dotColor: string }
  > = {
    pending: { label: "Pending", dotColor: "bg-yellow-500" },
    verified: { label: "Verified", dotColor: "bg-brand" },
    failed: { label: "Failed", dotColor: "bg-destructive" },
  };

  const { label, dotColor } = config[status];

  return (
    <span className="inline-flex items-center px-1.5 h-6 rounded-full border border-border bg-background">
      <div className="flex h-3 w-3 items-center justify-center">
        <span className={cn("h-2 w-2 rounded-full", dotColor)} />
      </div>
      <span className="type-small text-foreground px-1">{label}</span>
    </span>
  );
}

/**
 * Settings block for custom domain configuration.
 *
 * Displays the current domain status and provides access to the configuration modal.
 * Only visible to brand owners.
 */
function SetDomain() {
  const [open, setOpen] = useState(false);
  const { data: brandsData, isLoading: brandsLoading } = useUserBrandsQuery();
  const { data: user } = useUserQuery();
  const { data: domainData, isLoading: domainLoading } = useCustomDomainQuery();

  // During initial load, don't render anything
  if (brandsLoading || !brandsData) {
    return null;
  }

  const brands = (Array.isArray(brandsData) ? brandsData : []) as Brand[];
  const activeBrand = brands.find(
    (b: Brand) => b.id === (user as CurrentUser | null | undefined)?.brand_id,
  );

  // Only show to brand owners
  if (!activeBrand || activeBrand.role !== "owner") {
    return null;
  }

  // Extract domain from the response wrapper
  const domain = domainData?.domain ?? null;
  const hasDomain = domain !== null;
  const domainStatus = domain?.status as CustomDomainStatus | undefined;

  return (
    <div className="flex flex-row p-6 border justify-between items-center">
      <div className="flex flex-col gap-2">
        <h6 className="text-foreground">Custom Domain</h6>
        {hasDomain ? (
          <div className="flex items-center gap-3">
            <p className="text-secondary">{domain.domain}</p>
            {domainStatus && <DomainStatusBadge status={domainStatus} />}
          </div>
        ) : (
          <p className="text-secondary">
            Configure a custom domain to enable GS1-compliant QR codes.
          </p>
        )}
      </div>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={domainLoading}
      >
        Configure
      </Button>
      <CustomDomainModal open={open} onOpenChange={setOpen} />
    </div>
  );
}

export { SetDomain };
