"use client";

import {
  FIELD_GROUP_LABELS,
  FIELD_GROUP_ORDER,
  type FieldGroup,
  HIDDEN_FIELDS,
  getFieldGroup,
  getFieldUIInfo,
} from "@/components/integrations/field-config";
import {
  type FieldRowData,
  FieldSection,
} from "@/components/integrations/field-section";
import { SetupWizard } from "@/components/integrations/setup-wizard";

import { IntegrationLogo } from "@/components/integrations/integration-logo";
import {
  IntegrationInfoRow,
  type IntegrationStatus,
  type JobType,
  type SyncJobStatus,
  SyncProgressBlock,
} from "@/components/integrations/integration-status";
import { ConnectShopifyModal } from "@/components/modals/connect-shopify-modal";
import { DisconnectIntegrationModal } from "@/components/modals/disconnect-integration-modal";
import { PromoteToPrimaryModal } from "@/components/modals/promote-to-primary-modal";
import {
  useFieldMappingsQuery,
  useIntegrationBySlugQuerySuspense,
  usePromoteToPrimaryMutation,
  usePromotionStatusQuery,
  useSyncStatusQuery,
  useTriggerSyncMutation,
  useUpdateFieldMappingMutation,
  useUpdateIntegrationMutation,
} from "@/hooks/use-integrations";
import {
  useTriggerPromotionProgress,
  useTriggerSyncProgress,
} from "@/hooks/use-job-progress";
import { useUserQuerySuspense } from "@/hooks/use-user";
import { getConnectorFields } from "@v1/integrations";
import { Button } from "@v1/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Icons } from "@v1/ui/icons";
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
  const { data: user } = useUserQuerySuspense();
  const brandId = user?.brand_id ?? null;

  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [promoteModalOpen, setPromoteModalOpen] = useState(false);
  const [shopifyModalOpen, setShopifyModalOpen] = useState(false);
  const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null);

  // Optimistic sync state - shows "In progress" immediately when user clicks sync
  const [optimisticSyncStarted, setOptimisticSyncStarted] =
    useState<Date | null>(null);

  // Track active sync run for Trigger.dev realtime
  const [activeSyncRun, setActiveSyncRun] = useState<{
    runId: string;
    accessToken: string;
  } | null>(null);

  // Track active promotion run for Trigger.dev realtime
  const [activePromotionRun, setActivePromotionRun] = useState<{
    runId: string;
    accessToken: string;
  } | null>(null);

  // Auto-hide progress bar state
  const [showProgress, setShowProgress] = useState(true);

  // Track mount state to prevent hydration mismatch
  const [hasMounted, setHasMounted] = useState(true);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  const connection = connectionData?.data;
  const integrationInfo = connection?.integration;

  // For the setup wizard, we need to know if there's an existing primary integration.
  // Since the current connection has isPrimary, we can determine this.
  // If this integration is already primary, existingPrimary should be null.
  // If this integration is not primary, we don't need to show a specific name -
  // the wizard just needs to know if another primary exists.
  // For now, we use a simplified approach: the wizard will show the blocking message
  // only when needed, and we can enhance this later.
  const existingPrimary: string | null = null; // TODO: Add API endpoint to get primary name

  // Match identifier - load from connection or default to barcode
  const matchIdentifier =
    (connection?.matchIdentifier as "sku" | "barcode" | null) ?? "barcode";

  // Mutations
  const { mutate: updateIntegration } = useUpdateIntegrationMutation();
  const { mutate: promoteToPrimary, isPending: isPromoting } =
    usePromoteToPrimaryMutation();

  // Field configs to determine if setup is needed (only runs on client)
  const { data: fieldConfigsData, isLoading: fieldConfigsLoading } =
    useFieldMappingsQuery(connection?.id ?? null);

  // Sync status (initial load only - no polling)
  const { data: syncStatusData } = useSyncStatusQuery(connection?.id ?? null);

  // Real-time progress via Trigger.dev native realtime
  const { progress: syncProgress, runStatus: syncRunStatus } =
    useTriggerSyncProgress(
      activeSyncRun?.runId ?? null,
      activeSyncRun?.accessToken ?? null,
    );

  // Promotion progress via Trigger.dev native realtime
  const { progress: promotionProgress, runStatus: promotionRunStatus } =
    useTriggerPromotionProgress(
      activePromotionRun?.runId ?? null,
      activePromotionRun?.accessToken ?? null,
    );

  // Promotion status (initial load only - realtime handled via Trigger.dev)
  const { data: promotionStatusData } = usePromotionStatusQuery(
    connection?.id ?? null,
  );

  // Get connector fields
  const availableFields = useMemo(() => getConnectorFields(slug), [slug]);

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

  // Determine if syncing based on WebSocket progress or optimistic state
  const isSyncing =
    triggerSyncMutation.status === "pending" ||
    syncProgress?.status === "running" ||
    optimisticSyncStarted !== null;

  async function handleTriggerSync() {
    if (!connection?.id) return;

    // Optimistically show sync started immediately
    setOptimisticSyncStarted(new Date());

    try {
      const result = await triggerSyncMutation.mutateAsync({
        brand_integration_id: connection.id,
      });

      // Store runId and accessToken for Trigger.dev realtime subscription
      if (result.data?.id && result.data?.publicAccessToken) {
        setActiveSyncRun({
          runId: result.data.id,
          accessToken: result.data.publicAccessToken,
        });
      }

      toast.success("Sync started");
    } catch (error) {
      // Clear optimistic state on error
      setOptimisticSyncStarted(null);
      setActiveSyncRun(null);
      toast.error("Failed to start sync");
    }
  }

  // Clear optimistic state only when we have actual progress data (not just running status)
  // This prevents the brief indeterminate state while waiting for first metadata update
  useEffect(() => {
    // Only clear optimistic state once we have real progress data
    if (syncProgress?.processed !== undefined && syncProgress?.processed >= 0) {
      setOptimisticSyncStarted(null);
    }
    // Clear activeSyncRun when job completes
    if (
      syncRunStatus === "completed" ||
      syncRunStatus === "failed" ||
      syncRunStatus === "cancelled"
    ) {
      // Keep the activeSyncRun for a bit so the completion state is visible
      const timer = setTimeout(() => setActiveSyncRun(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [syncRunStatus, syncProgress?.processed]);

  // Clear activePromotionRun when promotion job completes
  useEffect(() => {
    if (
      promotionRunStatus === "completed" ||
      promotionRunStatus === "failed" ||
      promotionRunStatus === "cancelled"
    ) {
      // Keep the activePromotionRun for a bit so the completion state is visible
      const timer = setTimeout(() => setActivePromotionRun(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [promotionRunStatus]);

  // Auto-hide progress bar after job completion (5 second delay)
  const isJobRunning =
    syncRunStatus === "running" ||
    syncProgress?.status === "running" ||
    promotionRunStatus === "running" ||
    promotionProgress?.status === "running";
  const isJobCompleted =
    syncRunStatus === "completed" ||
    syncRunStatus === "failed" ||
    syncRunStatus === "cancelled" ||
    syncProgress?.status === "completed" ||
    syncProgress?.status === "failed" ||
    promotionRunStatus === "completed" ||
    promotionRunStatus === "failed" ||
    promotionRunStatus === "cancelled" ||
    promotionProgress?.status === "completed" ||
    promotionProgress?.status === "failed";

  useEffect(() => {
    if (isJobCompleted && !isJobRunning) {
      const timer = setTimeout(() => setShowProgress(false), 5000);
      return () => clearTimeout(timer);
    }
    if (isJobRunning) {
      setShowProgress(true);
    }
  }, [isJobCompleted, isJobRunning]);

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
      variants: [],
      organization: [],
      sales: [],
    };

    const visibleFields = availableFields.filter(
      (f) => !HIDDEN_FIELDS.has(f.fieldKey),
    );

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

    try {
      // API uses upsert - creates mapping if it doesn't exist
      await updateFieldMutation.mutateAsync({
        brand_integration_id: connection.id,
        field_key: fieldKey,
        ownership_enabled: enabled,
      });
    } catch (error) {
      toast.error("Failed to update field");
    }
  }

  function handleMatchIdentifierChange(value: "sku" | "barcode") {
    if (!connection?.id) return;

    updateIntegration(
      { id: connection.id, match_identifier: value },
      {
        onError: () => {
          toast.error("Failed to update match identifier");
        },
      },
    );
  }

  function handlePromote() {
    if (!connection?.id) return;

    promoteToPrimary(
      { id: connection.id },
      {
        onSuccess: (data) => {
          // Check if it was an instant promotion (no variants to regroup)
          if ("instant" in data && data.instant) {
            toast.success("Integration promoted to primary");
          } else {
            toast.success("Promotion started. This may take a few minutes.");
            // Store runId and accessToken for Trigger.dev realtime subscription
            if (
              "taskId" in data &&
              data.taskId &&
              "publicAccessToken" in data &&
              data.publicAccessToken
            ) {
              setActivePromotionRun({
                runId: data.taskId as string,
                accessToken: data.publicAccessToken as string,
              });
            }
          }
          setPromoteModalOpen(false);
        },
        onError: (error) => {
          toast.error(error.message || "Failed to start promotion");
          setActivePromotionRun(null);
        },
      },
    );
  }

  // Not connected state
  if (!connection) {
    return (
      <div className="space-y-6">
        <div className="border border-dashed border-border p-8 flex flex-col items-center justify-center gap-4 text-center">
          <IntegrationLogo slug={slug} size="lg" />
          <div className="flex flex-col gap-1">
            <h5 className="text-foreground font-medium">
              {integrationInfo?.name ?? slug} is not connected
            </h5>
            <p className="text-secondary text-sm max-w-[400px]">
              Connect this integration to start syncing product data
              automatically.
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
              <Link href="/settings/integrations" prefetch>
                Go to Integrations
              </Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  const status = connection.status as IntegrationStatus;

  // Get latest job info for initial state (before WebSocket connects)
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

  // Determine sync job status - prioritize Trigger.dev realtime data
  const syncJobStatus: SyncJobStatus | undefined =
    (syncRunStatus as SyncJobStatus) ??
    syncProgress?.status ??
    (latestJob?.status as SyncJobStatus | undefined);

  // Calculate progress percentage - prioritize WebSocket data
  const progress = useMemo(() => {
    // Use WebSocket progress if available
    if (syncProgress) {
      if (
        syncProgress.status === "completed" ||
        syncProgress.status === "failed"
      ) {
        return 100;
      }
      if (
        syncProgress.status === "running" &&
        syncProgress.total &&
        syncProgress.total > 0
      ) {
        return Math.round((syncProgress.processed / syncProgress.total) * 100);
      }
      return undefined; // Indeterminate
    }

    // Fallback to initial job data
    if (latestJob) {
      if (latestJob.status === "completed" || latestJob.status === "failed") {
        return 100;
      }
      if (
        latestJob.status === "running" &&
        latestJob.productsTotal &&
        latestJob.productsTotal > 0
      ) {
        return Math.round(
          (latestJob.productsProcessed / latestJob.productsTotal) * 100,
        );
      }
    }
    return undefined;
  }, [syncProgress, latestJob]);

  // Determine active job type (sync vs promotion)
  const activeJobType: JobType | null = useMemo(() => {
    // Check Trigger.dev realtime progress first
    if (
      promotionRunStatus === "running" ||
      promotionProgress?.status === "running"
    ) {
      return "promotion";
    }
    if (
      syncRunStatus === "running" ||
      syncProgress?.status === "running" ||
      optimisticSyncStarted
    ) {
      return "sync";
    }

    // Check for completed Trigger.dev jobs
    if (
      promotionRunStatus === "completed" ||
      promotionRunStatus === "failed" ||
      promotionProgress?.status === "completed" ||
      promotionProgress?.status === "failed"
    ) {
      return "promotion";
    }
    if (
      syncRunStatus === "completed" ||
      syncRunStatus === "failed" ||
      syncProgress?.status === "completed" ||
      syncProgress?.status === "failed"
    ) {
      return "sync";
    }

    // Fallback to initial sync data
    if (latestJob) {
      return "sync";
    }
    return null;
  }, [
    optimisticSyncStarted,
    syncProgress,
    syncRunStatus,
    promotionProgress,
    promotionRunStatus,
    latestJob,
  ]);

  // Show setup wizard if not completed
  if (setupCompleted === false) {
    return (
      <SetupWizard
        brandIntegrationId={connection.id}
        connectorSlug={slug}
        integrationName={integrationInfo?.name ?? slug}
        existingPrimaryName={existingPrimary}
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <IntegrationLogo slug={slug} size="lg" />
            <div className="space-y-1">
              <h5 className="type-h5 text-foreground">
                {integrationInfo?.name}
              </h5>
              <p className="type-small text-secondary">
                {getIntegrationDescription(slug)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleTriggerSync}
              disabled={isSyncing || status !== "active"}
            >
              {isSyncing ? "Syncing..." : "Sync now"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 data-[state=open]:bg-accent"
                >
                  <Icons.EllipsisVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!connection?.isPrimary && (
                  <>
                    <DropdownMenuItem onClick={() => setPromoteModalOpen(true)}>
                      <span className="flex items-center">
                        <Icons.ArrowUp className="h-4 w-4" />
                        <span className="px-1">Promote to Primary</span>
                      </span>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem
                  onClick={() => setDisconnectModalOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <span className="flex items-center">
                    <Icons.Unlink className="h-4 w-4" />
                    <span className="px-1">Disconnect</span>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Info row */}
      <IntegrationInfoRow
        lastSync={lastSyncTime}
        nextSync={nextSyncTime}
        status={status}
        mode={connection?.isPrimary ? "primary" : "secondary"}
        matchIdentifier={connection?.isPrimary ? undefined : matchIdentifier}
        onMatchIdentifierChange={
          connection?.isPrimary ? undefined : handleMatchIdentifierChange
        }
      />

      {/* Progress block - show sync or promotion progress, auto-hide after completion */}
      {showProgress &&
        (optimisticSyncStarted ||
          syncProgress ||
          promotionProgress ||
          latestJob) && (
          <SyncProgressBlock
            jobType={activeJobType ?? "sync"}
            status={
              optimisticSyncStarted
                ? "running"
                : activeJobType === "promotion"
                  ? (promotionRunStatus as SyncJobStatus) ??
                    promotionProgress?.status ??
                    null
                  : syncJobStatus ?? null
            }
            progress={
              optimisticSyncStarted
                ? 0
                : activeJobType === "promotion"
                  ? promotionProgress?.total && promotionProgress.total > 0
                    ? Math.round(
                        (promotionProgress.processed /
                          promotionProgress.total) *
                          100,
                      )
                    : undefined
                  : progress
            }
            startedAt={
              optimisticSyncStarted?.toISOString() ??
              (activeJobType === "promotion"
                ? promotionProgress?.startedAt ?? null
                : syncProgress?.startedAt ?? latestJob?.startedAt ?? null)
            }
            errorMessage={
              optimisticSyncStarted
                ? null
                : activeJobType === "promotion"
                  ? promotionProgress?.errorMessage ?? null
                  : syncProgress?.errorMessage ?? latestJob?.errorSummary
            }
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

      {/* Promote to Primary Modal */}
      <PromoteToPrimaryModal
        open={promoteModalOpen}
        onOpenChange={setPromoteModalOpen}
        integrationName={integrationInfo?.name ?? slug}
        integrationId={connection.id}
        onConfirm={handlePromote}
        isPromoting={isPromoting}
      />
    </div>
  );
}
