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
      <DialogContent className="max-w-[480px] p-0 gap-0 border border-border">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-foreground">
            Disconnect {integrationName}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-3">
          <DialogDescription className="text-secondary">
            Are you sure you want to disconnect this integration? This will:
          </DialogDescription>
          <ul className="space-y-1 text-secondary text-sm list-disc list-inside">
            <li>Stop automatic syncing</li>
            <li>Remove all field mappings</li>
            <li>Delete sync history</li>
          </ul>
          <p className="text-secondary text-sm">
            Your product data will <strong className="text-foreground">not</strong> be deleted.
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






