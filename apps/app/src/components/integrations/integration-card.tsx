"use client";

import type { Integration } from "@/hooks/use-integrations";
import {
  IntegrationStatusBadge,
  formatSyncTime,
  type IntegrationStatus,
} from "@/components/integrations/integration-status";
import { IntegrationLogo } from "@/components/integrations/integration-logo";
import { Button } from "@v1/ui/button";
import Link from "next/link";

interface IntegrationCardProps {
  integration: Integration;
  onConnect?: () => void;
}

/**
 * Card for displaying an integration with connection status.
 */
export function IntegrationCard({
  integration,
  onConnect,
}: IntegrationCardProps) {
  const connectionStatus =
    integration.connectionStatus as IntegrationStatus | null;
  const isConnected = !!connectionStatus;

  return (
    <div className="border border-border p-6 w-full flex flex-row justify-between items-center gap-4">
      <div className="flex items-center gap-4 flex-1">
        <IntegrationLogo slug={integration.slug} size="lg" />
        <div className="flex flex-col gap-1 flex-1">
          <div className="flex items-center gap-2">
            <h6 className="text-foreground font-medium">{integration.name}</h6>
            {connectionStatus && (
              <IntegrationStatusBadge status={connectionStatus} />
            )}
          </div>
          {integration.description && (
            <p className="text-secondary text-sm">{integration.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isConnected ? (
          <Button variant="outline" asChild>
            <Link href={`/settings/integrations/${integration.slug}`} prefetch>
              Manage
            </Link>
          </Button>
        ) : (
          <Button variant="outline" onClick={onConnect}>
            Connect
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Loading skeleton for integration cards.
 */
export function IntegrationCardSkeleton() {
  return (
    <div className="border border-border p-6 flex items-center gap-4 animate-pulse">
      <div className="h-10 w-10 bg-accent" />
      <div className="flex flex-col gap-2 flex-1">
        <div className="h-4 w-32 bg-accent" />
        <div className="h-3 w-24 bg-accent" />
      </div>
    </div>
  );
}
