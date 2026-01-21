"use client";

import { useUserQuery } from "@/hooks/use-user";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { useState } from "react";

interface ConnectShopifyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal for initiating Shopify OAuth connection.
 *
 * Asks for the Shopify store domain and redirects to the OAuth install
 * endpoint with the required shop and brand_id parameters.
 */
export function ConnectShopifyModal({
  open,
  onOpenChange,
}: ConnectShopifyModalProps) {
  const { data: user } = useUserQuery();
  const [shopDomain, setShopDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const brandId = (user as { brand_id?: string } | null)?.brand_id;

  /**
   * Normalize and validate the shop domain.
   * Accepts formats like:
   * - my-store
   * - my-store.myshopify.com
   * - https://my-store.myshopify.com
   */
  function normalizeShopDomain(input: string): string | null {
    let domain = input.trim().toLowerCase();

    // Remove protocol if present
    domain = domain.replace(/^https?:\/\//, "");

    // Remove trailing slash
    domain = domain.replace(/\/$/, "");

    // Remove /admin or other paths
    domain = domain.split("/")[0] ?? "";

    // Add .myshopify.com if not present
    if (!domain.includes(".")) {
      domain = `${domain}.myshopify.com`;
    }

    // Validate the domain format
    const shopRegex = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;
    if (!shopRegex.test(domain)) {
      return null;
    }

    return domain;
  }

  function handleConnect() {
    setError(null);

    if (!shopDomain.trim()) {
      setError("Please enter your Shopify store domain");
      return;
    }

    const normalizedDomain = normalizeShopDomain(shopDomain);
    if (!normalizedDomain) {
      setError(
        "Invalid store domain. Please enter a valid Shopify domain (e.g., my-store or my-store.myshopify.com)",
      );
      return;
    }

    if (!brandId) {
      setError("Unable to determine brand. Please try again.");
      return;
    }

    // Build the OAuth install URL and redirect
    setIsConnecting(true);
    const installUrl = new URL(
      `${process.env.NEXT_PUBLIC_API_URL}/integrations/shopify/install`,
    );
    installUrl.searchParams.set("shop", normalizedDomain);
    installUrl.searchParams.set("brand_id", brandId);

    window.location.href = installUrl.toString();
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      // Reset state when closing
      setShopDomain("");
      setError(null);
    }
    onOpenChange(newOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md" className="p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-foreground">Connect Shopify</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="shop-domain">Store domain</Label>
            <Input
              id="shop-domain"
              type="text"
              value={shopDomain}
              onChange={(e) => {
                setShopDomain(e.target.value);
                setError(null);
              }}
              placeholder="my-store.myshopify.com"
              className={error ? "border-destructive" : ""}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleConnect();
                }
              }}
            />
            {error ? (
              <p className="type-small text-destructive">{error}</p>
            ) : (
              <p className="type-small text-tertiary">
                Enter your store name or full domain (e.g., my-store or
                my-store.myshopify.com)
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-background">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            disabled={!shopDomain.trim() || isConnecting}
          >
            {isConnecting ? "Connecting..." : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
