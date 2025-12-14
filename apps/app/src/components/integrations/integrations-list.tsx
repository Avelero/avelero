"use client";

import { ConnectIntegrationModal } from "@/components/modals/connect-integration-modal";
import { ConnectShopifyModal } from "@/components/modals/connect-shopify-modal";
import {
  useAvailableIntegrationsQuerySuspense,
  useConnectedIntegrationsQuerySuspense,
  type AvailableIntegration,
} from "@/hooks/use-integrations";
import { useMemo, useState } from "react";
import {
  AvailableIntegrationCard,
  ConnectedIntegrationCard,
  EmptyIntegrationsState,
} from "./integration-card";

/**
 * Main integrations list component.
 *
 * Shows:
 * - Connected integrations (if any)
 * - Available integrations grid
 */
export function IntegrationsList() {
  const { data: availableData } = useAvailableIntegrationsQuerySuspense();
  const { data: connectedData } = useConnectedIntegrationsQuerySuspense();

  // API key integration modal state
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] =
    useState<AvailableIntegration | null>(null);

  // Shopify OAuth modal state
  const [shopifyModalOpen, setShopifyModalOpen] = useState(false);

  const available = availableData?.data ?? [];
  const connected = connectedData?.data ?? [];

  // Build set of connected integration slugs for quick lookup
  const connectedSlugs = useMemo(
    () => new Set(connected.map((c) => c.integration?.slug).filter(Boolean)),
    [connected],
  );

  function handleConnect(integration: AvailableIntegration) {
    // For Shopify (OAuth), open the Shopify-specific modal
    if (integration.slug === "shopify") {
      setShopifyModalOpen(true);
      return;
    }

    // For API key integrations, open the generic connect modal
    setSelectedIntegration(integration);
    setConnectModalOpen(true);
  }

  return (
    <div className="space-y-8">
      {/* Connected Integrations */}
      <section className="space-y-4">
        <h5 className="text-foreground font-medium">Connected Integrations</h5>

        {connected.length > 0 ? (
          <div className="space-y-2">
            {connected.map((integration) => (
              <ConnectedIntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        ) : (
          <EmptyIntegrationsState />
        )}
      </section>

      {/* Available Integrations */}
      <section className="space-y-4">
        <h5 className="text-foreground font-medium">Available Integrations</h5>

        <div className="space-y-2">
          {available.map((integration) => (
            <AvailableIntegrationCard
              key={integration.id}
              integration={integration}
              isConnected={connectedSlugs.has(integration.slug)}
              onConnect={() => handleConnect(integration)}
            />
          ))}
        </div>

        {available.length === 0 && (
          <div className="border border-dashed border-border p-8 text-center">
            <p className="text-secondary text-sm">
              No integrations available at this time.
            </p>
          </div>
        )}
      </section>

      {/* API Key Connect Modal */}
      <ConnectIntegrationModal
        integration={selectedIntegration}
        open={connectModalOpen}
        onOpenChange={setConnectModalOpen}
      />

      {/* Shopify OAuth Modal */}
      <ConnectShopifyModal
        open={shopifyModalOpen}
        onOpenChange={setShopifyModalOpen}
      />
    </div>
  );
}
