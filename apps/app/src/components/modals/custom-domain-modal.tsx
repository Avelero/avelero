"use client";

import {
  type CustomDomainStatus,
  useAddCustomDomainMutation,
  useCustomDomainQuery,
  useVerifyCustomDomainMutation,
} from "@/hooks/use-custom-domain";
import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import { cn } from "@v1/ui/cn";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Icons } from "@v1/ui/icons";
import { Input } from "@v1/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";
import { useEffect, useRef, useState } from "react";
import { RemoveDomainModal } from "./remove-domain-modal";

interface CustomDomainModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Domain details from the API */
interface DomainDetails {
  id: string;
  domain: string;
  status: "pending" | "verified";
  verificationToken: string;
  verificationError: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

/**
 * Status badge for domain verification state.
 * Shows "Verification Needed" in red when there's an error, with a tooltip.
 */
function DomainStatusBadge({
  status,
  hasError,
  tooltipText,
  shaking,
}: {
  status: CustomDomainStatus;
  hasError?: boolean;
  tooltipText?: string;
  shaking?: boolean;
}) {
  // When there's an error, show "Verification Needed" in red
  const isErrorState = hasError && status !== "verified";

  const label = isErrorState
    ? "Verification needed"
    : status === "verified"
      ? "Verified"
      : "Pending";

  const dotColor = isErrorState
    ? "bg-destructive"
    : status === "verified"
      ? "bg-brand"
      : "bg-yellow-500";

  const badge = (
    <span
      className={cn(
        "inline-flex items-center px-1.5 h-6 rounded-full border border-border bg-background cursor-default select-none",
        shaking && "animate-shake"
      )}
      style={
        shaking
          ? {
            animation: "shake 0.5s ease-in-out",
          }
          : undefined
      }
    >
      <style>
        {`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-2px); }
            40% { transform: translateX(2px); }
            60% { transform: translateX(-2px); }
            80% { transform: translateX(2px); }
          }
        `}
      </style>
      <div className="flex h-3 w-3 items-center justify-center">
        <span className={cn("h-2 w-2 rounded-full", dotColor)} />
      </div>
      <span className="type-small text-foreground px-1">{label}</span>
    </span>
  );

  // Wrap with tooltip if there's tooltip text
  if (tooltipText) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}

/**
 * DNS record display component with copy button.
 * Displays Name, Type, and Value horizontally with truncation for long values.
 */
/**
 * Copyable text that shows a small copy icon on hover.
 */
function CopyableText({
  text,
  className,
  truncate = false,
}: {
  text: string;
  className?: string;
  truncate?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently fail - user can manually select and copy
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "group flex items-center gap-1 text-left cursor-pointer max-w-full",
        truncate && "min-w-0 overflow-hidden"
      )}
      title={text}
    >
      <span
        className={cn(
          "type-small text-foreground font-mono",
          truncate && "truncate min-w-0",
          className
        )}
      >
        {text}
      </span>
      {copied ? (
        <Icons.Check className="h-3 w-3 text-brand flex-shrink-0" />
      ) : (
        <Icons.Copy className="h-3 w-3 text-tertiary opacity-0 group-hover:opacity-100 flex-shrink-0" />
      )}
    </button>
  );
}

function DnsRecordBlock({
  label,
  name,
  type,
  value,
}: {
  label: string;
  name: string;
  type: string;
  value: string;
}) {
  return (
    <div className="space-y-2 min-w-0">
      <p className="type-small text-secondary">{label}</p>
      <div className="border border-border p-3 overflow-hidden">
        <div className="flex items-center gap-3">
          {/* Name column - wide enough to show full names */}
          <div className="space-y-1 w-[280px] flex-shrink-0">
            <p className="type-small text-tertiary">Name</p>
            <CopyableText text={name} />
          </div>
          {/* Type column - fixed width */}
          <div className="space-y-1 w-[120px] flex-shrink-0">
            <p className="type-small text-tertiary">Type</p>
            <p className="type-small text-foreground">{type}</p>
          </div>
          {/* Value column - takes remaining space, truncates */}
          <div className="space-y-1 min-w-0 flex-1">
            <p className="type-small text-tertiary">Value</p>
            <CopyableText text={value} truncate />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Add domain form for when no domain is configured.
 */
function AddDomainContent({
  onCancel,
  onSuccess,
}: {
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [domainInput, setDomainInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const addDomain = useAddCustomDomainMutation();
  const isAdding = addDomain.status === "pending";

  function validateDomain(value: string): boolean {
    const trimmed = value.trim().toLowerCase();
    if (trimmed.length < 4) {
      setError("Domain must be at least 4 characters");
      return false;
    }
    if (trimmed.length > 253) {
      setError("Domain must be at most 253 characters");
      return false;
    }
    const domainRegex =
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
    if (!domainRegex.test(trimmed)) {
      setError("Invalid domain format");
      return false;
    }
    if (trimmed.includes("..")) {
      setError("Domain cannot contain consecutive dots");
      return false;
    }
    setError(null);
    return true;
  }

  async function handleSubmit() {
    const trimmed = domainInput.trim().toLowerCase();
    if (!validateDomain(trimmed)) return;

    try {
      await addDomain.mutateAsync({ domain: trimmed });
      onSuccess();
    } catch {
      // Error is handled by the mutation hook
    }
  }

  return (
    <>
      <DialogHeader className="px-6 py-4 border-b border-border">
        <DialogTitle className="text-foreground">
          Configure custom domain
        </DialogTitle>
      </DialogHeader>

      <div className="px-6 py-4 space-y-3">
        <DialogDescription className="text-secondary">
          Add a custom domain to enable GS1-compliant QR codes for your digital
          product passports.
        </DialogDescription>
        <div className="space-y-1.5">
          <Label htmlFor="domain-input" className="text-secondary">
            Domain
          </Label>
          <Input
            id="domain-input"
            value={domainInput}
            onChange={(e) => {
              setDomainInput(e.target.value);
              if (error) setError(null);
            }}
            placeholder="passport.yourbrand.com"
            className={cn(error && "border-destructive")}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isAdding) {
                void handleSubmit();
              }
            }}
          />
          {error && <p className="type-small text-destructive">{error}</p>}
        </div>
      </div>

      <DialogFooter className="px-6 py-4 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isAdding}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={handleSubmit}
          disabled={isAdding || domainInput.trim().length === 0}
        >
          {isAdding ? "Adding..." : "Add domain"}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * DNS instructions content for pending domains.
 */
function DnsInstructionsContent({
  domainDetails,
  onClose,
  onRemove,
}: {
  domainDetails: DomainDetails;
  onClose: () => void;
  onRemove: () => void;
}) {
  const verifyDomain = useVerifyCustomDomainMutation();
  const isVerifying = verifyDomain.status === "pending";
  const hasVerificationError = !!domainDetails.verificationError;
  const [shaking, setShaking] = useState(false);
  const previousDataRef = useRef(verifyDomain.data);

  // Detect when verification fails and trigger shake animation
  useEffect(() => {
    const currentData = verifyDomain.data;
    const previousData = previousDataRef.current;

    // Check if we just got a new failure result
    if (
      currentData &&
      currentData !== previousData &&
      currentData.success === false
    ) {
      setShaking(true);
      // Reset shaking after animation completes
      const timer = setTimeout(() => setShaking(false), 500);
      return () => clearTimeout(timer);
    }

    previousDataRef.current = currentData;
  }, [verifyDomain.data]);

  // Extract subdomain from full domain for DNS name display
  // e.g., "passport.nike.com" -> "passport"
  // e.g., "nike.com" -> "@" (root domain)
  const domainParts = domainDetails.domain.split(".");
  const cnameHost =
    domainParts.length > 2 ? domainParts.slice(0, -2).join(".") : "@";

  // TXT host must include subdomain to match verification lookup
  // e.g., "passport.nike.com" -> "_avelero-verification.passport"
  // e.g., "nike.com" -> "_avelero-verification"
  const txtHost =
    domainParts.length > 2
      ? `_avelero-verification.${domainParts.slice(0, -2).join(".")}`
      : "_avelero-verification";

  async function handleVerify() {
    await verifyDomain.mutateAsync();
  }

  return (
    <>
      <DialogHeader className="px-6 py-4 border-b border-border">
        <DialogTitle className="text-foreground">
          Configure custom domain
        </DialogTitle>
      </DialogHeader>

      <div className="px-6 py-4 space-y-4 overflow-hidden">
        {/* Domain name and status */}
        <div className="flex items-center justify-between">
          <p className="text-foreground font-medium">{domainDetails.domain}</p>
          <DomainStatusBadge
            status={domainDetails.status}
            hasError={hasVerificationError}
            tooltipText={
              hasVerificationError
                ? "Please add the DNS records and verify domain"
                : undefined
            }
            shaking={shaking}
          />
        </div>

        {/* DNS Instructions */}
        <div className="space-y-4">
          <p className="type-small text-secondary">
            Add these records in your DNS provider to configure your domain:
          </p>

          <DnsRecordBlock
            label="CNAME Record (for traffic routing)"
            name={cnameHost}
            type="CNAME"
            value="cname.avelero.com"
          />

          <DnsRecordBlock
            label="TXT Record (for verification)"
            name={txtHost}
            type="TXT"
            value={domainDetails.verificationToken}
          />

          <p className="type-small text-tertiary">
            DNS propagation may take up to 48 hours. After adding the records,
            click Verify domain to confirm ownership.
          </p>
        </div>
      </div>

      <DialogFooter className="px-6 py-4 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={onRemove}
          disabled={isVerifying}
          className="text-destructive hover:text-destructive"
        >
          Remove domain
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={handleVerify}
          disabled={isVerifying}
        >
          {isVerifying ? "Verifying..." : "Verify domain"}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Verified domain content showing success state.
 */
function VerifiedContent({
  domainDetails,
  onClose,
  onRemove,
}: {
  domainDetails: DomainDetails;
  onClose: () => void;
  onRemove: () => void;
}) {
  const verifiedDate = domainDetails.verifiedAt
    ? new Date(domainDetails.verifiedAt).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    : null;

  return (
    <>
      <DialogHeader className="px-6 py-4 border-b border-border">
        <DialogTitle className="text-foreground">
          Configure custom domain
        </DialogTitle>
      </DialogHeader>

      <div className="px-6 py-4">
        {/* Domain name and status */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-foreground font-medium">
              {domainDetails.domain}
            </p>
            {verifiedDate && (
              <p className="type-small text-tertiary">
                Verified on {verifiedDate}
              </p>
            )}
          </div>
          <DomainStatusBadge status="verified" />
        </div>
      </div>

      <DialogFooter className="px-6 py-4 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={onRemove}
          className="text-destructive hover:text-destructive"
        >
          Remove domain
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Done
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Main custom domain configuration modal.
 *
 * Handles 4 states:
 * - No domain: Add form
 * - Pending: DNS instructions
 * - Failed: Retry with DNS instructions
 * - Verified: Success state
 */
export function CustomDomainModal({
  open,
  onOpenChange,
}: CustomDomainModalProps) {
  const { data: domainData } = useCustomDomainQuery();
  const [removeModalOpen, setRemoveModalOpen] = useState(false);

  function handleClose() {
    onOpenChange(false);
  }

  function handleOpenRemoveModal() {
    setRemoveModalOpen(true);
  }

  function handleRemoved() {
    setRemoveModalOpen(false);
    // Domain query will be invalidated by the mutation
  }

  // Extract domain details from the response wrapper
  const domainDetails = domainData?.domain ?? null;
  const hasDomain = domainDetails !== null;
  const status = domainDetails?.status;
  const isVerified = status === "verified";
  // Treat any non-verified status as pending (handles legacy "failed" status in DB)
  const isPending = hasDomain && !isVerified;

  // Use narrow modal for add domain form and verified state, wide modal for DNS records table
  const modalSize = isPending ? "full" : "md";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size={modalSize} className="p-0 gap-0 overflow-hidden">
          {!hasDomain && (
            <AddDomainContent
              onCancel={handleClose}
              onSuccess={() => {
                // Stay open to show DNS instructions
              }}
            />
          )}
          {hasDomain && isPending && (
            <DnsInstructionsContent
              domainDetails={domainDetails}
              onClose={handleClose}
              onRemove={handleOpenRemoveModal}
            />
          )}
          {hasDomain && isVerified && (
            <VerifiedContent
              domainDetails={domainDetails}
              onClose={handleClose}
              onRemove={handleOpenRemoveModal}
            />
          )}
        </DialogContent>
      </Dialog>

      <RemoveDomainModal
        open={removeModalOpen}
        onOpenChange={setRemoveModalOpen}
        domainName={domainDetails?.domain ?? ""}
        onRemoved={handleRemoved}
      />
    </>
  );
}
