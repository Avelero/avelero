"use client";

import { useTRPC } from "@/trpc/client";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@v1/api/src/trpc/routers/_app";
import { useMemo } from "react";

/** tRPC router output types for type-safe hooks */
type RouterOutputs = inferRouterOutputs<AppRouter>;

/** Available integration type from master list */
export type AvailableIntegration =
  RouterOutputs["integrations"]["connections"]["listAvailable"]["data"][number];

/** Connected brand integration */
export type ConnectedIntegration =
  RouterOutputs["integrations"]["connections"]["list"]["data"][number];

/** Sync job from history - use the table types for proper typing */
export type SyncJob =
  RouterOutputs["integrations"]["sync"]["history"]["data"][number];

/** Field mapping configuration - use the table types for proper typing */
export type FieldMapping =
  RouterOutputs["integrations"]["mappings"]["list"]["data"][number];

// Re-export table types for convenience
export type { SyncJobRow, SyncJobStatus, TriggerType } from "@/components/tables/sync-history/types";
export type { FieldMappingRow, SourceOption, FieldCategory } from "@/components/tables/field-mappings/types";

// =============================================================================
// Connection Hooks
// =============================================================================

/**
 * Fetches all available integration types.
 *
 * @returns Query hook for available integrations
 */
export function useAvailableIntegrationsQuery() {
  const trpc = useTRPC();
  const opts = trpc.integrations.connections.listAvailable.queryOptions({});
  return useQuery({
    ...opts,
    enabled: typeof window !== "undefined",
  });
}

/**
 * Suspense version of useAvailableIntegrationsQuery.
 */
export function useAvailableIntegrationsQuerySuspense() {
  const trpc = useTRPC();
  const opts = trpc.integrations.connections.listAvailable.queryOptions({});
  return useSuspenseQuery(opts);
}

/**
 * Fetches all connected integrations for the current brand.
 *
 * @returns Query hook for connected integrations
 */
export function useConnectedIntegrationsQuery() {
  const trpc = useTRPC();
  const opts = trpc.integrations.connections.list.queryOptions({});
  return useQuery({
    ...opts,
    enabled: typeof window !== "undefined",
  });
}

/**
 * Suspense version of useConnectedIntegrationsQuery.
 */
export function useConnectedIntegrationsQuerySuspense() {
  const trpc = useTRPC();
  const opts = trpc.integrations.connections.list.queryOptions({});
  return useSuspenseQuery(opts);
}

/**
 * Fetches a specific connected integration by slug.
 *
 * @param slug - Integration slug (e.g., "shopify")
 * @returns Query hook for the integration
 */
export function useIntegrationBySlugQuery(slug: string) {
  const trpc = useTRPC();
  const opts = trpc.integrations.connections.getBySlug.queryOptions({ slug });
  return useQuery({
    ...opts,
    enabled: typeof window !== "undefined" && !!slug,
  });
}

/**
 * Suspense version of useIntegrationBySlugQuery.
 */
export function useIntegrationBySlugQuerySuspense(slug: string) {
  const trpc = useTRPC();
  const opts = trpc.integrations.connections.getBySlug.queryOptions({ slug });
  return useSuspenseQuery(opts);
}

/**
 * Connect a new API key integration.
 *
 * @returns Mutation hook for connecting
 */
export function useConnectIntegrationMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.integrations.connections.connect.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.integrations.connections.list.queryKey({}),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.integrations.connections.listAvailable.queryKey({}),
          }),
        ]);
      },
    }),
  );
}

/**
 * Disconnect an integration.
 *
 * @returns Mutation hook for disconnecting
 */
export function useDisconnectIntegrationMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.integrations.connections.disconnect.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.integrations.connections.list.queryKey({}),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.integrations.connections.listAvailable.queryKey({}),
          }),
        ]);
      },
    }),
  );
}

/**
 * Test integration connection.
 *
 * @returns Mutation hook for testing
 */
export function useTestConnectionMutation() {
  const trpc = useTRPC();
  return useMutation(trpc.integrations.connections.testConnection.mutationOptions({}));
}

/**
 * Update integration settings.
 *
 * @returns Mutation hook for updating
 */
export function useUpdateIntegrationMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.integrations.connections.update.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.integrations.connections.list.queryKey({}),
        });
      },
    }),
  );
}

// =============================================================================
// Field Mapping Hooks
// =============================================================================

/**
 * Fetches field mappings for an integration.
 *
 * @param brandIntegrationId - Brand integration ID
 * @returns Query hook for field mappings
 */
export function useFieldMappingsQuery(brandIntegrationId: string | null) {
  const trpc = useTRPC();
  const opts = trpc.integrations.mappings.list.queryOptions({
    brand_integration_id: brandIntegrationId ?? "",
  });
  return useQuery({
    ...opts,
    enabled: typeof window !== "undefined" && !!brandIntegrationId,
  });
}

/**
 * Suspense version of useFieldMappingsQuery.
 */
export function useFieldMappingsQuerySuspense(brandIntegrationId: string) {
  const trpc = useTRPC();
  const opts = trpc.integrations.mappings.list.queryOptions({
    brand_integration_id: brandIntegrationId,
  });
  return useSuspenseQuery(opts);
}

/**
 * Update a field mapping.
 *
 * @returns Mutation hook for updating field mapping
 */
export function useUpdateFieldMappingMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.integrations.mappings.update.mutationOptions({
      onSuccess: async (_data, variables) => {
        await queryClient.invalidateQueries({
          queryKey: trpc.integrations.mappings.list.queryKey({
            brand_integration_id: variables.brand_integration_id,
          }),
        });
      },
    }),
  );
}

/**
 * Batch update field mappings.
 *
 * @returns Mutation hook for batch updating
 */
export function useUpdateFieldMappingsBatchMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.integrations.mappings.updateBatch.mutationOptions({
      onSuccess: async (_data, variables) => {
        await queryClient.invalidateQueries({
          queryKey: trpc.integrations.mappings.list.queryKey({
            brand_integration_id: variables.brand_integration_id,
          }),
        });
      },
    }),
  );
}

/**
 * List all field ownerships across integrations.
 *
 * @returns Query hook for all ownerships
 */
export function useAllOwnershipsQuery() {
  const trpc = useTRPC();
  const opts = trpc.integrations.mappings.listAllOwnerships.queryOptions({});
  return useQuery({
    ...opts,
    enabled: typeof window !== "undefined",
  });
}

// =============================================================================
// Sync Hooks
// =============================================================================

/**
 * Fetches sync history for an integration.
 *
 * @param brandIntegrationId - Brand integration ID
 * @returns Query hook for sync history
 */
export function useSyncHistoryQuery(brandIntegrationId: string | null, limit = 20) {
  const trpc = useTRPC();
  const opts = trpc.integrations.sync.history.queryOptions({
    brand_integration_id: brandIntegrationId ?? "",
    limit,
  });
  return useQuery({
    ...opts,
    enabled: typeof window !== "undefined" && !!brandIntegrationId,
  });
}

/**
 * Suspense version of useSyncHistoryQuery.
 */
export function useSyncHistoryQuerySuspense(brandIntegrationId: string, limit = 20) {
  const trpc = useTRPC();
  const opts = trpc.integrations.sync.history.queryOptions({
    brand_integration_id: brandIntegrationId,
    limit,
  });
  return useSuspenseQuery(opts);
}

/**
 * Get current sync status.
 *
 * @param brandIntegrationId - Brand integration ID
 * @returns Query hook for sync status
 */
export function useSyncStatusQuery(brandIntegrationId: string | null) {
  const trpc = useTRPC();
  const opts = trpc.integrations.sync.status.queryOptions({
    brand_integration_id: brandIntegrationId ?? "",
  });
  return useQuery({
    ...opts,
    enabled: typeof window !== "undefined" && !!brandIntegrationId,
    refetchInterval: 5000, // Poll every 5 seconds for active syncs
  });
}

/**
 * Trigger a manual sync.
 *
 * @returns Mutation hook for triggering sync
 */
export function useTriggerSyncMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.integrations.sync.trigger.mutationOptions({
      onSuccess: async (_data, variables) => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.integrations.sync.history.queryKey({
              brand_integration_id: variables.brand_integration_id,
            }),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.integrations.sync.status.queryKey({
              brand_integration_id: variables.brand_integration_id,
            }),
          }),
        ]);
      },
    }),
  );
}

// =============================================================================
// Utility Hooks
// =============================================================================

/**
 * Finds an available integration by slug.
 *
 * @param slug - Integration slug
 * @returns Available integration or null
 */
export function useAvailableIntegrationBySlug(slug: string | null) {
  const { data } = useAvailableIntegrationsQuery();
  return useMemo(() => {
    if (!slug || !data?.data) return null;
    return data.data.find((i) => i.slug === slug) ?? null;
  }, [data, slug]);
}

/**
 * Finds a connected integration by slug.
 *
 * @param slug - Integration slug
 * @returns Connected integration or null
 */
export function useConnectedIntegrationBySlug(slug: string | null) {
  const { data } = useConnectedIntegrationsQuery();
  return useMemo(() => {
    if (!slug || !data?.data) return null;
    return data.data.find((i) => i.integration?.slug === slug) ?? null;
  }, [data, slug]);
}



