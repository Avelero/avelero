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

/** tRPC router output types for type-safe hooks */
type RouterOutputs = inferRouterOutputs<AppRouter>;

/** Integration with connection status */
export type Integration =
  RouterOutputs["integrations"]["connections"]["list"]["data"][number];

/** Sync job from history */
export type SyncJob =
  RouterOutputs["integrations"]["sync"]["history"]["data"][number];

/** Field mapping configuration */
export type FieldMapping =
  RouterOutputs["integrations"]["mappings"]["list"]["data"][number];

// Re-export types from integrations module
export type {
  IntegrationStatus,
  SyncJobStatus,
} from "@/components/integrations/integration-status";

// =============================================================================
// Connection Hooks
// =============================================================================

/**
 * Fetches all integrations with connection status.
 */
export function useIntegrationsQuery() {
  const trpc = useTRPC();
  const opts = trpc.integrations.connections.list.queryOptions({});
  return useQuery({
    ...opts,
    enabled: typeof window !== "undefined",
  });
}

/**
 * Suspense version of useIntegrationsQuery.
 */
export function useIntegrationsQuerySuspense() {
  const trpc = useTRPC();
  const opts = trpc.integrations.connections.list.queryOptions({});
  return useSuspenseQuery(opts);
}

/**
 * Suspense query for a specific integration by slug.
 */
export function useIntegrationBySlugQuerySuspense(slug: string) {
  const trpc = useTRPC();
  const opts = trpc.integrations.connections.getBySlug.queryOptions({ slug });
  return useSuspenseQuery(opts);
}

/**
 * Connect a new API key integration.
 */
export function useConnectIntegrationMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.integrations.connections.connect.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.integrations.connections.list.queryKey({}),
        });
      },
    }),
  );
}

/**
 * Disconnect an integration.
 */
export function useDisconnectIntegrationMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.integrations.connections.disconnect.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.integrations.connections.list.queryKey({}),
        });
      },
    }),
  );
}

/**
 * Update integration settings.
 */
export function useUpdateIntegrationMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.integrations.connections.update.mutationOptions({
      onSuccess: async () => {
        // Invalidate all connection-related queries (list AND getBySlug)
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.integrations.connections.list.queryKey({}),
          }),
          // Use predicate to invalidate all getBySlug queries regardless of slug
          queryClient.invalidateQueries({
            predicate: (query) =>
              Array.isArray(query.queryKey) &&
              query.queryKey[0]?.[0] === "integrations" &&
              query.queryKey[0]?.[1] === "connections" &&
              query.queryKey[0]?.[2] === "getBySlug",
          }),
        ]);
      },
    }),
  );
}

// =============================================================================
// Field Mapping Hooks
// =============================================================================

/**
 * Fetches field mappings for an integration.
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
 * Use this when you want the component to suspend until field mappings are loaded.
 */
export function useFieldMappingsQuerySuspense(brandIntegrationId: string) {
  const trpc = useTRPC();
  const opts = trpc.integrations.mappings.list.queryOptions({
    brand_integration_id: brandIntegrationId,
  });
  return useSuspenseQuery(opts);
}

/**
 * Update a field mapping with optimistic updates.
 */
export function useUpdateFieldMappingMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.integrations.mappings.update.mutationOptions({
      onMutate: async (variables) => {
        const queryKey = trpc.integrations.mappings.list.queryKey({
          brand_integration_id: variables.brand_integration_id,
        });

        // Cancel outgoing refetches to avoid overwriting optimistic update
        await queryClient.cancelQueries({ queryKey });

        // Snapshot previous value for rollback
        const previousData = queryClient.getQueryData(queryKey);

        // Optimistically update the cache
        queryClient.setQueryData(
          queryKey,
          (old: RouterOutputs["integrations"]["mappings"]["list"] | undefined) => {
            if (!old?.data) return old;

            // Check if mapping exists
            const exists = old.data.some((m) => m.fieldKey === variables.field_key);

            if (exists) {
              // Update existing mapping
              return {
                ...old,
                data: old.data.map((mapping) =>
                  mapping.fieldKey === variables.field_key
                    ? {
                      ...mapping,
                      ownershipEnabled: variables.ownership_enabled ?? false,
                      sourceOptionKey: variables.source_option_key ?? mapping.sourceOptionKey,
                    }
                    : mapping,
                ),
              };
            }
            // Add new mapping (optimistic - will be replaced by server response)
            return {
              ...old,
              data: [
                ...old.data,
                {
                  id: `temp-${variables.field_key}`,
                  brandIntegrationId: variables.brand_integration_id,
                  fieldKey: variables.field_key,
                  ownershipEnabled: variables.ownership_enabled ?? false,
                  sourceOptionKey: variables.source_option_key ?? null,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
            };
          },
        );

        return { previousData, queryKey };
      },
      onError: (_error, _variables, context) => {
        // Rollback on error
        if (context?.previousData !== undefined) {
          queryClient.setQueryData(context.queryKey, context.previousData);
        }
      },
      onSettled: async (_data, _error, variables) => {
        // Always refetch after mutation to ensure consistency
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

// =============================================================================
// Sync Hooks
// =============================================================================

/**
 * Get current sync status (fetches once, real-time updates via useJobProgress).
 */
export function useSyncStatusQuery(brandIntegrationId: string | null) {
  const trpc = useTRPC();
  const opts = trpc.integrations.sync.status.queryOptions({
    brand_integration_id: brandIntegrationId ?? "",
  });
  return useQuery({
    ...opts,
    enabled: typeof window !== "undefined" && !!brandIntegrationId,
    // No polling - real-time updates come via WebSocket (useJobProgress hook)
  });
}

/**
 * Trigger a manual sync.
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
// Promotion Hooks
// =============================================================================

/**
 * Promote an integration to primary.
 * This triggers the re-grouping algorithm that restructures products.
 */
export function usePromoteToPrimaryMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.integrations.connections.promoteToPrimary.mutationOptions({
      onSuccess: async () => {
        // Invalidate all connection-related queries (list AND getBySlug)
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.integrations.connections.list.queryKey({}),
          }),
          // Use predicate to invalidate all getBySlug queries regardless of slug
          queryClient.invalidateQueries({
            predicate: (query) =>
              Array.isArray(query.queryKey) &&
              query.queryKey[0]?.[0] === "integrations" &&
              query.queryKey[0]?.[1] === "connections" &&
              query.queryKey[0]?.[2] === "getBySlug",
          }),
        ]);
      },
    }),
  );
}

/**
 * Get promotion operation status with optional polling.
 *
 * @param brandIntegrationId - The brand integration ID to check status for
 * @param options - Query options including optional refetchInterval for polling
 */
export function usePromotionStatusQuery(
  brandIntegrationId: string | null,
  options?: { refetchInterval?: number | false },
) {
  const trpc = useTRPC();
  const opts = trpc.integrations.promotion.status.queryOptions({
    brand_integration_id: brandIntegrationId ?? "",
  });
  return useQuery({
    ...opts,
    enabled: typeof window !== "undefined" && !!brandIntegrationId,
    refetchInterval: options?.refetchInterval ?? false,
  });
}
