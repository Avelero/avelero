"use client";

import {
  type CustomDomainStatus,
  useAddCustomDomainMutation,
  useCustomDomainQuery,
  useVerifyCustomDomainMutation,
} from "@/hooks/use-custom-domain";
import { Button } from "@v1/ui/button";
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
import { toast } from "@v1/ui/sonner";
import { useState } from "react";
import { RemoveDomainModal } from "./remove-domain-modal";

interface CustomDomainModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Domain details from the API */
interface DomainDetails {
  id: string;
  domain: string;
  status: "pending" | "verified" | "failed";
  verificationToken: string;
  verificationError: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

/**
 * Status badge for domain verification state.
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
 * DNS record display component with copy button.
 */
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
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy. Please select and copy manually.");
    }
  }

  return (
    <div className="space-y-2">
      <p className="type-small text-secondary">{label}</p>
      <div className="border border-border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="type-small text-tertiary">Name</p>
            <p className="type-small text-foreground font-mono">{name}</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="type-small text-tertiary">Type</p>
            <p className="type-small text-foreground">{type}</p>
          </div>
        </div>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0 flex-1">
            <p className="type-small text-tertiary">Value</p>
            <p className="type-small text-foreground font-mono break-all">
              {value}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex-shrink-0 p-1.5 hover:bg-accent transition-colors"
            aria-label={`Copy ${label.toLowerCase()}`}
          >
            {copied ? (
              <Icons.Check className="h-4 w-4 text-brand" />
            ) : (
              <Icons.Copy className="h-4 w-4 text-tertiary hover:text-secondary" />
            )}
          </button>
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
          Configure Custom Domain
        </DialogTitle>
        <DialogDescription className="text-secondary">
          Add a custom domain to enable GS1-compliant QR codes for your digital
          product passports.
        </DialogDescription>
      </DialogHeader>

      <div className="px-6 py-4 space-y-3">
        <div className="space-y-2">
          <label htmlFor="domain-input" className="type-small text-secondary">
            Domain
          </label>
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
          <p className="type-small text-tertiary">
            Example: passport.nike.com, dpp.mybrand.com
          </p>
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
          {isAdding ? "Adding..." : "Add Domain"}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * DNS instructions content for pending/failed domains.
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
  const status = domainDetails.status;
  const isFailed = status === "failed";

  // Extract subdomain from full domain for DNS name display
  const domainParts = domainDetails.domain.split(".");
  const subdomain =
    domainParts.length > 2
      ? domainParts.slice(0, -2).join(".")
      : domainParts[0];

  async function handleVerify() {
    await verifyDomain.mutateAsync();
  }

  return (
    <>
      <DialogHeader className="px-6 py-4 border-b border-border">
        <DialogTitle className="text-foreground">
          Configure Custom Domain
        </DialogTitle>
      </DialogHeader>

      <div className="px-6 py-4 space-y-4">
        {/* Domain name and status */}
        <div className="flex items-center justify-between">
          <p className="text-foreground font-medium">{domainDetails.domain}</p>
          <DomainStatusBadge status={status} />
        </div>

        {/* Error message for failed verification */}
        {isFailed && domainDetails.verificationError && (
          <div className="border border-destructive/30 bg-destructive/5 p-3">
            <div className="flex items-start gap-2">
              <Icons.AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="type-small text-destructive font-medium">
                  Verification failed
                </p>
                <p className="type-small text-destructive/80">
                  {domainDetails.verificationError}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* DNS Instructions */}
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="type-small text-foreground font-medium">
              Step 1: Add DNS Records
            </p>
            <p className="type-small text-secondary">
              Add these records in your DNS provider:
            </p>
          </div>

          <DnsRecordBlock
            label="CNAME Record (for traffic routing)"
            name={subdomain ?? domainDetails.domain}
            type="CNAME"
            value="dpp.avelero.com"
          />

          <DnsRecordBlock
            label="TXT Record (for verification)"
            name={`_avelero-verification.${subdomain ?? domainDetails.domain}`}
            type="TXT"
            value={domainDetails.verificationToken}
          />

          <p className="type-small text-tertiary">
            DNS propagation may take up to 48 hours.
          </p>
        </div>

        <div className="border-t border-border" />

        {/* Step 2 */}
        <div className="space-y-1">
          <p className="type-small text-foreground font-medium">
            Step 2: Verify Domain
          </p>
          <p className="type-small text-secondary">
            After adding the DNS records, verify ownership:
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
          Remove Domain
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={handleVerify}
          disabled={isVerifying}
        >
          {isVerifying
            ? "Verifying..."
            : isFailed
              ? "Try Again"
              : "Verify Domain"}
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
          Configure Custom Domain
        </DialogTitle>
      </DialogHeader>

      <div className="px-6 py-4 space-y-4">
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

        <div className="border-t border-border" />

        {/* Success message */}
        <div className="space-y-2">
          <p className="type-small text-secondary">
            Your custom domain is active and ready for use.
          </p>
          <p className="type-small text-secondary">
            Digital product passports can now be accessed at:
          </p>
          <ul className="space-y-1">
            <li className="type-small text-foreground font-mono">
              https://{domainDetails.domain}/{"{upid}"}
            </li>
            <li className="type-small text-foreground font-mono">
              https://{domainDetails.domain}/01/{"{barcode}"}{" "}
              <span className="text-tertiary font-sans">(GS1 format)</span>
            </li>
          </ul>
        </div>

        <div className="border-t border-border" />

        {/* Warning */}
        <div className="flex items-start gap-2">
          <Icons.Info className="h-4 w-4 text-secondary flex-shrink-0 mt-0.5" />
          <p className="type-small text-secondary">
            Keep your DNS records in place. Removing them will make your custom
            domain URLs inaccessible.
          </p>
        </div>
      </div>

      <DialogFooter className="px-6 py-4 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={onRemove}
          className="text-destructive hover:text-destructive"
        >
          Remove Domain
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
  const isPendingOrFailed = status === "pending" || status === "failed";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="md" className="p-0 gap-0">
          {!hasDomain && (
            <AddDomainContent
              onCancel={handleClose}
              onSuccess={() => {
                // Stay open to show DNS instructions
              }}
            />
          )}
          {hasDomain && isPendingOrFailed && (
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
