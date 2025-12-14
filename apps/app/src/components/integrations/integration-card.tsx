"use client";

import type { AvailableIntegration, ConnectedIntegration } from "@/hooks/use-integrations";
import {
  IntegrationStatusBadge,
  formatSyncTime,
} from "@/components/tables/sync-history";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import Link from "next/link";
import { ShopifyLogo } from "../logos/shopify-logo";

interface AvailableIntegrationCardProps {
  integration: AvailableIntegration;
  isConnected?: boolean;
  onConnect?: () => void;
}

interface ConnectedIntegrationCardProps {
  integration: ConnectedIntegration;
  onDisconnect?: () => void;
}

/**
 * Integration logo component.
 * Displays a placeholder icon if no logo is available.
 */
function IntegrationLogo({
  slug,
  name,
  className,
}: {
  slug: string;
  name: string;
  className?: string;
}) {
  // For known integrations, we could add specific logos here
  // For now, use a generic icon
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-accent text-secondary",
        className,
      )}
    >
      {slug === "shopify" ? (
        <ShopifyLogo className="h-6 w-6" />
      ) : (
        <Icons.Link className="h-6 w-6" />
      )}
    </div>
  );
}

/**
 * Card for displaying an available integration type.
 */
export function AvailableIntegrationCard({
  integration,
  isConnected,
  onConnect,
}: AvailableIntegrationCardProps) {
  return (
    <div className="border border-border p-6 w-full flex flex-row justify-between items-center gap-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <IntegrationLogo
            slug={integration.slug}
            name={integration.name}
            className="h-12 w-12"
          />
          <div className="flex flex-col gap-1">
            <h6 className="text-foreground font-medium">{integration.name}</h6>
            <p className="text-secondary text-sm">
              {integration.description}
            </p>
          </div>
        </div>
        {isConnected && <IntegrationStatusBadge status="active" />}
      </div>

      <div className="flex justify-end">
        {isConnected ? (
          <Button variant="outline" asChild>
            <Link href={`/settings/integrations/${integration.slug}`}>Configure</Link>
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
 * Card for displaying a connected integration.
 */
export function ConnectedIntegrationCard({ integration }: ConnectedIntegrationCardProps) {
  const integrationInfo = integration.integration;
  const status = integration.status as
    | "pending"
    | "active"
    | "error"
    | "paused"
    | "disconnected";

  return (
    <Link
      href={`/settings/integrations/${integrationInfo?.slug}`}
      className="block border border-border p-6 hover:bg-accent/50 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <IntegrationLogo
            slug={integrationInfo?.slug ?? "unknown"}
            name={integrationInfo?.name ?? "Unknown"}
            className="h-10 w-10"
          />
          <div className="flex flex-col gap-0.5">
            <h6 className="text-foreground font-medium">
              {integrationInfo?.name ?? "Unknown Integration"}
            </h6>
            <p className="text-secondary text-sm">
              Last sync: {formatSyncTime(integration.lastSyncAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <IntegrationStatusBadge status={status} />
          <Icons.ChevronRight className="h-4 w-4 text-secondary" />
        </div>
      </div>
    </Link>
  );
}

/**
 * Empty state for when no integrations are connected.
 */
export function EmptyIntegrationsState() {
  return (
    <div className="border border-dashed border-border p-8 flex flex-col items-center justify-center gap-4 text-center">
      <div className="flex items-center justify-center h-12 w-12 bg-accent text-secondary">
        <Icons.Link className="h-6 w-6" />
      </div>
      <div className="flex flex-col gap-1">
        <h6 className="text-foreground font-medium">No integrations connected</h6>
        <p className="text-secondary text-sm max-w-[300px]">
          Connect an integration to automatically sync product data from external systems.
        </p>
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
