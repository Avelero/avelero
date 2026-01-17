"use client";

import { useDisconnectIntegrationMutation } from "@/hooks/use-integrations";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { toast } from "@v1/ui/sonner";

interface DisconnectIntegrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationId: string;
  integrationName: string;
  onDisconnected?: () => void;
}

/**
 * Modal for confirming integration disconnection.
 *
 * Warns user about the consequences and requires confirmation
 * before disconnecting the integration.
 */
export function DisconnectIntegrationModal({
  open,
  onOpenChange,
  integrationId,
  integrationName,
  onDisconnected,
}: DisconnectIntegrationModalProps) {
  const disconnectMutation = useDisconnectIntegrationMutation();
  const isDisconnecting = disconnectMutation.status === "pending";

  async function handleDisconnect() {
    try {
      await disconnectMutation.mutateAsync({ id: integrationId });
      toast.success(`Disconnected from ${integrationName}`);
      onOpenChange(false);
      onDisconnected?.();
    } catch (error) {
      toast.error("Failed to disconnect integration");
    }
  }

  function handleOpenChange(newOpen: boolean) {
    if (isDisconnecting) return;
    onOpenChange(newOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md" className="p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-foreground">
            Disconnect {integrationName}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-3">
          <DialogDescription className="text-secondary type-p">
            Are you sure you want to disconnect this integration? This will stop
            automatic syncing.
          </DialogDescription>
          <p className="text-secondary type-p">
            Your product data will{" "}
            <span className="text-foreground font-medium">not</span> be deleted.
          </p>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-background">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isDisconnecting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDisconnect}
            disabled={isDisconnecting}
          >
            {isDisconnecting ? "Disconnecting..." : "Disconnect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
