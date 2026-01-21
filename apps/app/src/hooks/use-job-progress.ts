"use client";

import { useRealtimeRun } from "@trigger.dev/react-hooks";
import { useMemo } from "react";

// =============================================================================
// Types
// =============================================================================

export type JobProgressStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Progress metadata stored in Trigger.dev run metadata.
 * Used by all job types that send progress updates.
 */
export interface JobProgressMetadata {
  status: "running" | "completed" | "failed";
  processed: number;
  total: number | null;
  startedAt: string;
  errorMessage?: string | null;
  context?: Record<string, unknown>;
}

// =============================================================================
// Generic Trigger.dev Realtime Progress Hook
// =============================================================================

/**
 * Generic hook to subscribe to job progress via Trigger.dev native realtime.
 * Uses useRealtimeRun to subscribe directly to the Trigger.dev run.
 *
 * @param runId - The Trigger.dev run ID (returned when triggering a job)
 * @param accessToken - Public access token for the run (returned when triggering a job)
 * @param metadataKey - The key in run.metadata where progress is stored (e.g., "syncProgress")
 */
export function useTriggerJobProgress<
  T extends JobProgressMetadata = JobProgressMetadata,
>(
  runId: string | null,
  accessToken: string | null,
  metadataKey: string,
): {
  progress: T | null;
  runStatus: JobProgressStatus | null;
  error: Error | null;
} {
  const isEnabled = !!runId && !!accessToken;

  const { run, error } = useRealtimeRun(runId ?? "", {
    accessToken: accessToken ?? "",
    enabled: isEnabled,
  });

  // Extract progress from run metadata using the specified key
  const progress = useMemo(() => {
    if (!run?.metadata?.[metadataKey]) return null;
    return run.metadata[metadataKey] as unknown as T;
  }, [run?.metadata, metadataKey]);

  // Map Trigger.dev run status to our status type
  const runStatus = useMemo((): JobProgressStatus | null => {
    if (!run) return null;
    // Trigger.dev statuses from SDK 4.0.6
    switch (run.status) {
      case "EXECUTING":
        return "running";
      case "COMPLETED":
        return "completed";
      case "FAILED":
      case "CRASHED":
      case "SYSTEM_FAILURE":
      case "TIMED_OUT":
      case "EXPIRED":
        return "failed";
      case "CANCELED":
        return "cancelled";
      default:
        // QUEUED, DEQUEUED, WAITING, DELAYED, PENDING_VERSION, and unknown statuses
        return "pending";
    }
  }, [run?.status]);

  return { progress, runStatus, error: error ?? null };
}

// =============================================================================
// Convenience Hooks (typed wrappers around useTriggerJobProgress)
// =============================================================================

/**
 * Sync progress metadata structure.
 */
export interface SyncProgressMetadata extends JobProgressMetadata {
  context?: { brandIntegrationId: string };
}

/**
 * Hook to subscribe to sync job progress via Trigger.dev native realtime.
 */
export function useTriggerSyncProgress(
  runId: string | null,
  accessToken: string | null,
) {
  return useTriggerJobProgress<SyncProgressMetadata>(
    runId,
    accessToken,
    "syncProgress",
  );
}

/**
 * Promotion progress metadata structure.
 */
export interface PromotionProgressMetadata extends JobProgressMetadata {
  context?: { brandIntegrationId: string };
}

/**
 * Hook to subscribe to promotion job progress via Trigger.dev native realtime.
 */
export function useTriggerPromotionProgress(
  runId: string | null,
  accessToken: string | null,
) {
  return useTriggerJobProgress<PromotionProgressMetadata>(
    runId,
    accessToken,
    "promotionProgress",
  );
}

/**
 * Import progress metadata structure.
 */
export interface ImportProgressMetadata extends JobProgressMetadata {
  context?: { importJobId?: string };
}

/**
 * Hook to subscribe to import job progress via Trigger.dev native realtime.
 */
function useTriggerImportProgress(
  runId: string | null,
  accessToken: string | null,
) {
  return useTriggerJobProgress<ImportProgressMetadata>(
    runId,
    accessToken,
    "importProgress",
  );
}

/**
 * Export progress metadata structure.
 */
export interface ExportProgressMetadata extends JobProgressMetadata {
  context?: { exportJobId?: string };
  downloadUrl?: string | null;
}

/**
 * Hook to subscribe to export job progress via Trigger.dev native realtime.
 */
export function useTriggerExportProgress(
  runId: string | null,
  accessToken: string | null,
) {
  return useTriggerJobProgress<ExportProgressMetadata>(
    runId,
    accessToken,
    "exportProgress",
  );
}
