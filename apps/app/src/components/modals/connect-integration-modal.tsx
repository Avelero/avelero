"use client";

import {
  useConnectIntegrationMutation,
  type AvailableIntegration,
} from "@/hooks/use-integrations";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { toast } from "@v1/ui/sonner";
import { useState } from "react";

interface ConnectIntegrationModalProps {
  integration: AvailableIntegration | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal for connecting an API key integration.
 *
 * For OAuth integrations, users are redirected directly to the OAuth flow.
 */
export function ConnectIntegrationModal({
  integration,
  open,
  onOpenChange,
}: ConnectIntegrationModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  const connectMutation = useConnectIntegrationMutation();
  const isSubmitting = connectMutation.status === "pending";

  function resetForm() {
    setApiKey("");
    setApiSecret("");
    setBaseUrl("");
  }

  async function handleConnect() {
    if (!integration || !apiKey.trim()) return;

    try {
      await connectMutation.mutateAsync({
        integration_slug: integration.slug,
        api_key: apiKey.trim(),
        api_secret: apiSecret.trim() || undefined,
        base_url: baseUrl.trim() || undefined,
      });

      toast.success(`Connected to ${integration.name}`);
      resetForm();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to connect integration",
      );
    }
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  }

  if (!integration) return null;

  // Determine which fields to show based on integration
  const showApiSecret = integration.slug === "its-perfect";
  const showBaseUrl = integration.slug === "its-perfect";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[480px] p-0 gap-0 border border-border">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-foreground">
            Connect {integration.name}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          <p className="text-secondary text-sm">
            Enter your {integration.name} API credentials to connect.
          </p>

          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="api-key" className="text-foreground text-sm font-medium">
                API Key
              </label>
              <Input
                id="api-key"
                type="password"
                placeholder="Enter API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
              />
            </div>

            {showApiSecret && (
              <div className="flex flex-col gap-2">
                <label htmlFor="api-secret" className="text-foreground text-sm font-medium">
                  API Secret
                </label>
                <Input
                  id="api-secret"
                  type="password"
                  placeholder="Enter API secret"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  autoComplete="off"
                />
              </div>
            )}

            {showBaseUrl && (
              <div className="flex flex-col gap-2">
                <label htmlFor="base-url" className="text-foreground text-sm font-medium">
                  Base URL <span className="text-secondary font-normal">(optional)</span>
                </label>
                <Input
                  id="base-url"
                  type="url"
                  placeholder="https://api.example.com"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
                <p className="text-secondary text-xs">
                  Only needed for self-hosted instances.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-background">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            disabled={isSubmitting || !apiKey.trim()}
          >
            {isSubmitting ? "Connecting..." : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



