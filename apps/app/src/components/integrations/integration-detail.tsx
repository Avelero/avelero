"use client";

import { FieldSetup } from "@/components/integrations/field-setup";
import { ConnectShopifyModal } from "@/components/modals/connect-shopify-modal";
import { FieldMappingTable } from "@/components/tables/field-mappings";
import {
  IntegrationStatusBadge,
  SyncHistoryTable,
  SyncStats,
  formatSyncTime,
  type SyncJobRow,
} from "@/components/tables/sync-history";
import {
  useAvailableIntegrationBySlug,
  useDisconnectIntegrationMutation,
  useFieldMappingsQuery,
  useIntegrationBySlugQuerySuspense,
  useSyncHistoryQuery,
  useTriggerSyncMutation,
} from "@/hooks/use-integrations";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Icons } from "@v1/ui/icons";
import { toast } from "@v1/ui/sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ShopifyLogo } from "../logos/shopify-logo";

interface IntegrationDetailProps {
  slug: string;
}

/**
 * Integration logo component.
 */
function IntegrationLogo({ slug, className }: { slug: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center bg-accent text-secondary ${className}`}>
      {slug === "shopify" ? (
        <ShopifyLogo className="h-6 w-6" />
      ) : (
        <Icons.Link className="h-6 w-6" />
      )}
    </div>
  );
}

/**
 * Disconnect confirmation modal.
 */
function DisconnectModal({
  open,
  onOpenChange,
  integrationName,
  integrationId,
  onDisconnected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationName: string;
  integrationId: string;
  onDisconnected: () => void;
}) {
  const disconnectMutation = useDisconnectIntegrationMutation();
  const isDisconnecting = disconnectMutation.status === "pending";

  async function handleDisconnect() {
    try {
      await disconnectMutation.mutateAsync({ id: integrationId });
      toast.success(`Disconnected from ${integrationName}`);
      onOpenChange(false);
      onDisconnected();
    } catch (error) {
      toast.error("Failed to disconnect integration");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] p-0 gap-0 border border-border">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-foreground">Disconnect {integrationName}</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4">
          <p className="text-secondary text-sm">
            Are you sure you want to disconnect this integration? This will:
          </p>
          <ul className="mt-3 space-y-1 text-secondary text-sm list-disc list-inside">
            <li>Stop automatic syncing</li>
            <li>Remove all field mappings</li>
            <li>Delete sync history</li>
          </ul>
          <p className="mt-3 text-secondary text-sm">
            Your product data will <strong>not</strong> be deleted.
          </p>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-background">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDisconnecting}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDisconnect} disabled={isDisconnecting}>
            {isDisconnecting ? "Disconnecting..." : "Disconnect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Main integration detail component.
 */
export function IntegrationDetail({ slug }: IntegrationDetailProps) {
  const router = useRouter();
  const { data: connectionData } = useIntegrationBySlugQuerySuspense(slug);
  const availableIntegration = useAvailableIntegrationBySlug(slug);

  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [shopifyModalOpen, setShopifyModalOpen] = useState(false);
  const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null);
  
  // Track mount state to prevent hydration mismatch
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  const connection = connectionData?.data;
  const integrationInfo = connection?.integration ?? availableIntegration;

  // Field configs to determine if setup is needed
  const { data: fieldConfigsData, isLoading: fieldConfigsLoading } = useFieldMappingsQuery(
    connection?.id ?? null,
  );

  // Determine if setup is needed based on field configs
  // Setup is needed if there are no field configs in the database
  // Once setupCompleted is true (either from DB or user action), don't reset it
  useEffect(() => {
    if (!connection?.id) {
      setSetupCompleted(null);
      return;
    }
    // Don't override if user just completed setup
    if (setupCompleted === true) return;
    if (fieldConfigsLoading) return;
    
    const hasFieldConfigs = (fieldConfigsData?.data?.length ?? 0) > 0;
    setSetupCompleted(hasFieldConfigs);
  }, [connection?.id, fieldConfigsData, fieldConfigsLoading, setupCompleted]);

  // Sync hooks
  const triggerSyncMutation = useTriggerSyncMutation();
  const { data: historyData, isLoading: historyLoading } = useSyncHistoryQuery(
    connection?.id ?? null,
  );

  const syncHistory = (historyData?.data ?? []) as SyncJobRow[];
  const isSyncing = triggerSyncMutation.status === "pending";

  async function handleTriggerSync() {
    if (!connection?.id) return;

    try {
      await triggerSyncMutation.mutateAsync({
        brand_integration_id: connection.id,
      });
      toast.success("Sync started");
    } catch (error) {
      toast.error("Failed to start sync");
    }
  }

  function handleDisconnected() {
    router.push("/settings/integrations");
  }

  // Not connected state
  if (!connection) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-secondary">
          <Link
            href="/settings/integrations"
            className="hover:text-foreground transition-colors"
          >
            Integrations
          </Link>
          <Icons.ChevronRight className="h-4 w-4" />
          <span className="text-foreground">{integrationInfo?.name ?? slug}</span>
        </div>

        <div className="border border-dashed border-border p-8 flex flex-col items-center justify-center gap-4 text-center">
          <IntegrationLogo slug={slug} className="h-16 w-16" />
          <div className="flex flex-col gap-1">
            <h5 className="text-foreground font-medium">
              {integrationInfo?.name ?? slug} is not connected
            </h5>
            <p className="text-secondary text-sm max-w-[400px]">
              Connect this integration to start syncing product data automatically.
            </p>
          </div>
          {slug === "shopify" ? (
            <>
              <Button onClick={() => setShopifyModalOpen(true)}>
                Connect {integrationInfo?.name ?? "Shopify"}
              </Button>
              <ConnectShopifyModal
                open={shopifyModalOpen}
                onOpenChange={setShopifyModalOpen}
              />
            </>
          ) : (
            <Button asChild>
              <Link href="/settings/integrations">Go to Integrations</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  const status = connection.status as
    | "pending"
    | "active"
    | "error"
    | "paused"
    | "disconnected";

  // Calculate next sync time
  const nextSyncTime =
    connection.lastSyncAt && connection.syncInterval
      ? new Date(
          new Date(connection.lastSyncAt).getTime() + connection.syncInterval * 1000,
        ).toISOString()
      : null;

  // Show setup wizard if field configs haven't been configured yet
  if (setupCompleted === false) {
    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-secondary text-sm">
          <Link
            href="/settings/integrations"
            className="hover:text-foreground transition-colors"
          >
            Integrations
          </Link>
          <Icons.ChevronRight className="h-4 w-4" />
          <Link
            href={`/settings/integrations/${slug}`}
            className="hover:text-foreground transition-colors"
          >
            {integrationInfo?.name}
          </Link>
          <Icons.ChevronRight className="h-4 w-4" />
          <span className="text-foreground">Setup</span>
        </div>

        {/* Header */}
        <div className="flex items-center gap-4">
          <IntegrationLogo slug={slug} className="h-12 w-12" />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h4 className="text-foreground font-medium text-lg">
                Setup {integrationInfo?.name}
              </h4>
              <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 border border-amber-200">
                Setup Required
              </span>
            </div>
            <p className="text-secondary text-sm">
              Connected to {connection.shopDomain ?? "your store"}
            </p>
          </div>
        </div>

        {/* Field Setup Wizard */}
        <FieldSetup
          brandIntegrationId={connection.id}
          connectorSlug={slug}
          integrationName={integrationInfo?.name ?? slug}
          onSetupComplete={() => setSetupCompleted(true)}
        />
      </div>
    );
  }

  // Show loading state while checking setup status
  // Use hasMounted to prevent hydration mismatch - always show loading on initial render
  if (!hasMounted || (setupCompleted === null && connection?.id)) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-2 text-secondary text-sm">
          <Link
            href="/settings/integrations"
            className="hover:text-foreground transition-colors"
          >
            Integrations
          </Link>
          <Icons.ChevronRight className="h-4 w-4" />
          <span className="text-foreground">{integrationInfo?.name}</span>
        </div>
        <div className="flex items-center justify-center py-12">
          <Icons.Loader2 className="h-8 w-8 animate-spin text-secondary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-secondary text-sm">
        <Link
          href="/settings/integrations"
          className="hover:text-foreground transition-colors"
        >
          Integrations
        </Link>
        <Icons.ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{integrationInfo?.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <IntegrationLogo slug={slug} className="h-12 w-12" />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h4 className="text-foreground font-medium text-lg">
                {integrationInfo?.name}
              </h4>
              <IntegrationStatusBadge status={status} />
            </div>
            <p className="text-secondary text-sm">
              Last sync: {formatSyncTime(connection.lastSyncAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleTriggerSync}
            disabled={isSyncing || status !== "active"}
          >
            {isSyncing ? (
              <>
                <Icons.Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Icons.RefreshCw className="h-4 w-4 mr-2" />
                Sync Now
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => setDisconnectModalOpen(true)}>
            Disconnect
          </Button>
        </div>
      </div>

      {/* Sync Stats */}
      <section className="space-y-4">
        <h5 className="text-foreground font-medium">Sync Status</h5>
        <SyncStats
          lastSync={connection.lastSyncAt}
          nextSync={nextSyncTime}
          totalSyncs={syncHistory.length}
        />
      </section>

      {/* Field Mappings */}
      <section className="space-y-4">
        <h5 className="text-foreground font-medium">Field Mappings</h5>
        <p className="text-secondary text-sm">
          Configure which fields to sync from {integrationInfo?.name}.
        </p>
        <FieldMappingTable brandIntegrationId={connection.id} connectorSlug={slug} />
      </section>

      {/* Sync History */}
      <section className="space-y-4">
        <h5 className="text-foreground font-medium">Sync History</h5>
        <SyncHistoryTable jobs={syncHistory} isLoading={historyLoading} />
      </section>

      {/* Disconnect Modal */}
      <DisconnectModal
        open={disconnectModalOpen}
        onOpenChange={setDisconnectModalOpen}
        integrationName={integrationInfo?.name ?? slug}
        integrationId={connection.id}
        onDisconnected={handleDisconnected}
      />
    </div>
  );
}
