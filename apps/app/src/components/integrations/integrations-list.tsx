"use client";

import { ConnectIntegrationModal } from "@/components/modals/connect-integration-modal";
import {
  type Integration,
  useIntegrationsQuerySuspense,
} from "@/hooks/use-integrations";
import { useUserQuerySuspense } from "@/hooks/use-user";
import { useState } from "react";
import { IntegrationCard } from "./integration-card";

/**
 * Main integrations list component.
 *
 * Shows a unified list of all integrations with their connection status.
 */
export function IntegrationsList() {
  const { data } = useIntegrationsQuerySuspense();
  const { data: user } = useUserQuerySuspense();
  const brandId = user?.brand_id ?? null;

  // API key integration modal state
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] =
    useState<Integration | null>(null);

  const integrations = data?.data ?? [];

  function handleConnect(integration: Integration) {
    // For Shopify (OAuth), redirect directly to the install endpoint
    // This uses Shopify's managed install flow - no shop URL input needed
    if (integration.slug === "shopify") {
      if (!brandId) {
        console.error("Cannot connect Shopify: no brand_id");
        return;
      }
      const installUrl = `${process.env.NEXT_PUBLIC_API_URL}/integrations/shopify/install?brand_id=${brandId}`;
      window.location.href = installUrl;
      return;
    }

    // For API key integrations, open the generic connect modal
    setSelectedIntegration(integration);
    setConnectModalOpen(true);
  }

  return (
    <div className="space-y-8">
      {/* Integrations */}
      <section className="space-y-4">
        <h5 className="type-h5 text-foreground">Integrations</h5>

        {integrations.length > 0 ? (
          <div className="space-y-2">
            {integrations.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                onConnect={() => handleConnect(integration)}
              />
            ))}
          </div>
        ) : (
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
    </div>
  );
}
