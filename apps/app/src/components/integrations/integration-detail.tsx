"use client";

import { FieldSetup } from "@/components/integrations/field-setup";
import {
  FieldSection,
  type FieldRowData,
} from "@/components/integrations/field-section";
import {
  FIELD_GROUP_LABELS,
  FIELD_GROUP_ORDER,
  HIDDEN_FIELDS,
  getFieldGroup,
  getFieldUIInfo,
  type FieldGroup,
} from "@/components/integrations/field-config";
import { IntegrationLogo } from "@/components/integrations/integration-logo";
import {
  IntegrationInfoRow,
  SyncProgressBlock,
  type IntegrationStatus,
  type SyncJobStatus,
} from "@/components/integrations/integration-status";
import { ConnectShopifyModal } from "@/components/modals/connect-shopify-modal";
import { DisconnectIntegrationModal } from "@/components/modals/disconnect-integration-modal";
import {
  useFieldMappingsQuery,
  useIntegrationBySlugQuerySuspense,
  useSyncStatusQuery,
  useTriggerSyncMutation,
  useUpdateFieldMappingMutation,
} from "@/hooks/use-integrations";
import { getConnectorFields } from "@v1/integrations/ui";
import { Button } from "@v1/ui/button";
import { Skeleton } from "@v1/ui/skeleton";
import { toast } from "@v1/ui/sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

interface IntegrationDetailProps {
  slug: string;
}

/**
 * Get a description for the integration based on its slug
 */
function getIntegrationDescription(slug: string): string {
  const descriptions: Record<string, string> = {
    shopify: "Synchronize product data from your Shopify store to Avelero",
  };
  return descriptions[slug] ?? "Synchronize product data from this integration";
}

/**
 * Skeleton for the integration detail page.
 * Used by both Suspense fallback and loading states.
 */
export function IntegrationDetailSkeleton() {
  return (
      <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3 mx-4">
      <Skeleton className="h-8 w-8" />
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-[28px] w-[80px]" />
            <Skeleton className="h-[18px] w-[96px]" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-[36px] w-[80px]" />
            <Skeleton className="h-[36px] w-[80px]" />
          </div>
        </div>
      </div>

      <div className="flex flex-row items-start gap-4 mx-4">
      <div className="flex flex-col items-start gap-2">
        <Skeleton className="h-[24px] w-[60px]" />
        <Skeleton className="h-[24px] w-[60px]" />
        <Skeleton className="h-[24px] w-[60px]" />
      </div>
      <div className="flex flex-col items-start gap-2">
        <Skeleton className="h-[24px] w-[200px]" />
        <Skeleton className="h-[24px] w-[200px]" />
        <Skeleton className="h-[24px] w-[76px]" />
      </div>
    </div>

    <Skeleton className="h-[98px] w-full" />

    <Skeleton className="h-[385px] w-full" />
    <Skeleton className="h-[251px] w-full" />
    <Skeleton className="h-[184px] w-full" />
    </div>
  );
}

/**
 * Main integration detail component.
 */
export function IntegrationDetail({ slug }: IntegrationDetailProps) {
  const router = useRouter();
  const { data: connectionData } = useIntegrationBySlugQuerySuspense(slug);

  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [shopifyModalOpen, setShopifyModalOpen] = useState(false);
  const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null);
  
  // Optimistic sync state - shows "In progress" immediately when user clicks sync
  const [optimisticSyncStarted, setOptimisticSyncStarted] = useState<Date | null>(null);

  // Track mount state to prevent hydration mismatch
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  const connection = connectionData?.data;
  const integrationInfo = connection?.integration;

  // Field configs to determine if setup is needed (only runs on client)
  const { data: fieldConfigsData, isLoading: fieldConfigsLoading } = useFieldMappingsQuery(
    connection?.id ?? null,
  );

  // Sync status with polling
  const { data: syncStatusData } = useSyncStatusQuery(connection?.id ?? null);

  // Get connector fields
  const availableFields = useMemo(
    () => getConnectorFields(slug),
    [slug],
  );

  // Determine if setup is needed based on field configs
  useEffect(() => {
    if (!connection?.id) {
      setSetupCompleted(null);
      return;
    }
    if (setupCompleted === true) return;
    if (fieldConfigsLoading) return;

    const hasFieldConfigs = (fieldConfigsData?.data?.length ?? 0) > 0;
    setSetupCompleted(hasFieldConfigs);
  }, [connection?.id, fieldConfigsData, fieldConfigsLoading, setupCompleted]);

  // Mutations
  const triggerSyncMutation = useTriggerSyncMutation();
  const updateFieldMutation = useUpdateFieldMappingMutation();

  const isSyncing = triggerSyncMutation.status === "pending" ||
    syncStatusData?.data?.isSyncing;

  async function handleTriggerSync() {
    if (!connection?.id) return;

    // Optimistically show sync started immediately
    setOptimisticSyncStarted(new Date());

    try {
      await triggerSyncMutation.mutateAsync({
        brand_integration_id: connection.id,
      });
      toast.success("Sync started");
    } catch (error) {
      // Clear optimistic state on error
      setOptimisticSyncStarted(null);
      toast.error("Failed to start sync");
    }
  }
  
  // Clear optimistic state when real sync status is available
  useEffect(() => {
    if (syncStatusData?.data?.isSyncing) {
      setOptimisticSyncStarted(null);
    }
  }, [syncStatusData?.data?.isSyncing]);

  function handleDisconnected() {
    router.push("/settings/integrations");
  }

  // Build field sections for display
  const fieldMappings = fieldConfigsData?.data ?? [];
  const fieldMappingMap = useMemo(() => {
    const map = new Map<string, { enabled: boolean; id: string }>();
    for (const mapping of fieldMappings) {
      map.set(mapping.fieldKey, {
        enabled: mapping.ownershipEnabled,
        id: mapping.id,
      });
    }
    return map;
  }, [fieldMappings]);

  const groupedFields = useMemo(() => {
    const groups: Record<FieldGroup, FieldRowData[]> = {
      product: [],
      organization: [],
      sales: [],
    };

    const visibleFields = availableFields.filter((f) => !HIDDEN_FIELDS.has(f.fieldKey));

    for (const field of visibleFields) {
      const group = getFieldGroup(field.fieldKey);
      const uiInfo = getFieldUIInfo(field);
      const mapping = fieldMappingMap.get(field.fieldKey);

      groups[group].push({
        fieldKey: field.fieldKey,
        label: uiInfo.label,
        description: uiInfo.description,
        enabled: mapping?.enabled ?? false,
      });
    }

    return groups;
  }, [availableFields, fieldMappingMap]);

  async function handleFieldToggle(fieldKey: string, enabled: boolean) {
    if (!connection?.id) return;

    const mapping = fieldMappingMap.get(fieldKey);
    if (!mapping) return;

    try {
      await updateFieldMutation.mutateAsync({
        brand_integration_id: connection.id,
        field_key: fieldKey,
        ownership_enabled: enabled,
      });
    } catch (error) {
      toast.error("Failed to update field");
    }
  }

  // Not connected state
  if (!connection) {
    return (
      <div className="space-y-6">
        <div className="border border-dashed border-border p-8 flex flex-col items-center justify-center gap-4 text-center">
          <IntegrationLogo slug={slug} size="sm" />
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

  const status = connection.status as IntegrationStatus;

  // Get latest job info for progress display
  const latestJob = syncStatusData?.data?.latestJob;

  // Use sync status data for dates (more accurate than connection data)
  // Falls back to latestJob.finishedAt if lastSyncAt isn't set on the connection
  const lastSyncTime =
    syncStatusData?.data?.lastSyncAt ??
    (latestJob?.status === "completed" ? latestJob.finishedAt : null) ??
    connection.lastSyncAt;

  // Use nextSyncAt from sync status API (it calculates this server-side)
  // Or calculate from lastSyncTime if available
  const nextSyncTime =
    syncStatusData?.data?.nextSyncAt ??
    (lastSyncTime && connection.syncInterval
      ? new Date(
          new Date(lastSyncTime).getTime() + connection.syncInterval * 1000,
        ).toISOString()
      : null);
  const syncJobStatus = latestJob?.status as SyncJobStatus | undefined;

  // Calculate progress percentage from productsProcessed / productsTotal
  const progress = latestJob
    ? syncJobStatus === "completed"
      ? 100
      : syncJobStatus === "failed"
        ? 100
        : syncJobStatus === "running" && latestJob.productsTotal && latestJob.productsTotal > 0
          ? Math.round((latestJob.productsProcessed / latestJob.productsTotal) * 100)
          : undefined // No total available: show indeterminate
    : undefined;

  // Show field setup if not completed
  if (setupCompleted === false) {
    return (
      <FieldSetup
        brandIntegrationId={connection.id}
        connectorSlug={slug}
        integrationName={integrationInfo?.name ?? slug}
        onCancel={() => router.push("/settings/integrations")}
        onSetupComplete={() => setSetupCompleted(true)}
      />
    );
  }

  // Show skeleton while checking setup status (instead of spinner)
  if (!hasMounted || (setupCompleted === null && connection?.id)) {
    return <IntegrationDetailSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3 mx-4">
        <IntegrationLogo slug={slug} size="sm" />
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h5 className="type-h5 text-foreground">
              {integrationInfo?.name}
            </h5>
            <p className="type-small text-secondary">
              {getIntegrationDescription(slug)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleTriggerSync}
              disabled={isSyncing || status !== "active"}
            >
              {isSyncing ? "Syncing..." : "Sync now"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => setDisconnectModalOpen(true)}
            >
              Disconnect
            </Button>
          </div>
        </div>
      </div>

      {/* Info row */}
      <IntegrationInfoRow
        lastSync={lastSyncTime}
        nextSync={nextSyncTime}
        status={status}
      />

      {/* Sync progress block - show optimistic state or real sync status */}
      {(optimisticSyncStarted || latestJob) && (
        <SyncProgressBlock
          status={optimisticSyncStarted ? "running" : (syncJobStatus ?? null)}
          progress={optimisticSyncStarted ? 0 : progress}
          startedAt={optimisticSyncStarted?.toISOString() ?? latestJob?.startedAt ?? null}
          errorMessage={optimisticSyncStarted ? null : latestJob?.errorSummary}
        />
      )}

      {/* Configure fields section */}
      <section className="space-y-4">
        {FIELD_GROUP_ORDER.map((groupKey) => {
          const fields = groupedFields[groupKey];
          if (fields.length === 0) return null;

          return (
            <FieldSection
              key={groupKey}
              title={FIELD_GROUP_LABELS[groupKey]}
              fields={fields}
              onToggle={handleFieldToggle}
            />
          );
        })}
      </section>

      {/* Disconnect Modal */}
      <DisconnectIntegrationModal
        open={disconnectModalOpen}
        onOpenChange={setDisconnectModalOpen}
        integrationName={integrationInfo?.name ?? slug}
        integrationId={connection.id}
        onDisconnected={handleDisconnected}
      />
    </div>
  );
}
