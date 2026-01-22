"use client";

import { useRemoveCustomDomainMutation } from "@/hooks/use-custom-domain";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";

interface RemoveDomainModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domainName: string;
  onRemoved?: () => void;
}

/**
 * Confirmation modal for removing a custom domain.
 *
 * Warns user about the consequences of removal and requires confirmation
 * before proceeding. Follows the same styling pattern as other confirmation
 * modals in the application.
 */
export function RemoveDomainModal({
  open,
  onOpenChange,
  domainName,
  onRemoved,
}: RemoveDomainModalProps) {
  const removeMutation = useRemoveCustomDomainMutation();
  const isRemoving = removeMutation.status === "pending";

  async function handleRemove() {
    try {
      await removeMutation.mutateAsync();
      onOpenChange(false);
      onRemoved?.();
    } catch {
      // Error is handled by the mutation hook
    }
  }

  function handleOpenChange(newOpen: boolean) {
    if (isRemoving) return;
    onOpenChange(newOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md" className="p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-foreground">Remove domain</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-3">
          <DialogDescription className="text-secondary type-p">
            Are you sure you want to remove{" "}
            <span className="text-foreground font-medium">{domainName}</span>?
          </DialogDescription>
          <p className="text-secondary type-p">
            This will disable your custom domain URLs. Existing QR codes pointing
            to this domain will{" "}
            <span className="text-foreground font-medium">stop working</span>.
          </p>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isRemoving}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleRemove}
            disabled={isRemoving}
          >
            {isRemoving ? "Removing..." : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
