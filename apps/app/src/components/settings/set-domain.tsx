"use client";

import {
  type CustomDomainStatus,
  useCustomDomainQuery,
} from "@/hooks/use-custom-domain";
import { useUserBrandsQuery } from "@/hooks/use-brand";
import { type CurrentUser, useUserQuery } from "@/hooks/use-user";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";
import { useState } from "react";
import { CustomDomainModal } from "../modals/custom-domain-modal";

interface Brand {
  id: string;
  name: string;
  role: "owner" | "member";
}

/**
 * Status badge for custom domain verification state.
 * Shows "Verification Needed" in red when there's an error, with a tooltip.
 */
function DomainStatusBadge({
  status,
  hasError,
}: {
  status: CustomDomainStatus;
  hasError?: boolean;
}) {
  // When there's an error, show "Verification Needed" in red
  const isErrorState = hasError && status !== "verified";

  const label = isErrorState
    ? "Verification Needed"
    : status === "verified"
      ? "Verified"
      : "Pending";

  const dotColor = isErrorState
    ? "bg-destructive"
    : status === "verified"
      ? "bg-brand"
      : "bg-yellow-500";

  const badge = (
    <span className="inline-flex items-center px-1.5 h-6 rounded-full border border-border bg-background cursor-default select-none">
      <div className="flex h-3 w-3 items-center justify-center">
        <span className={cn("h-2 w-2 rounded-full", dotColor)} />
      </div>
      <span className="type-small text-foreground px-1">{label}</span>
    </span>
  );

  // Wrap with tooltip if there's an error
  if (isErrorState) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>
            <p>Please add the DNS records and verify domain.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
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
  const hasVerificationError = !!domain?.verificationError;

  return (
    <div className="flex flex-row p-6 border justify-between items-center">
      <div className="flex flex-col gap-2">
        <h6 className="text-foreground">Custom Domain</h6>
        {hasDomain ? (
          <div className="flex items-center gap-3">
            <p className="text-secondary">{domain.domain}</p>
            {domainStatus && (
              <DomainStatusBadge
                status={domainStatus}
                hasError={hasVerificationError}
              />
            )}
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
