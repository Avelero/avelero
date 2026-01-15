"use client";

import { useRealtimeRun } from "@trigger.dev/react-hooks";
import { createClient } from "@v1/supabase/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type JobProgressType = "sync" | "promotion" | "import" | "export";
export type JobProgressStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface JobProgressData {
  jobId: string;
  jobType: JobProgressType;
  status: JobProgressStatus;
  processed: number;
  total: number | null;
  startedAt: string | null;
  errorMessage?: string | null;
  context?: Record<string, unknown>;
}

// =============================================================================
// Trigger.dev Native Realtime Hook for Sync Progress
// =============================================================================

export interface SyncProgressMetadata {
  status: "running" | "completed" | "failed";
  processed: number;
  total: number | null;
  startedAt: string;
  errorMessage?: string | null;
  context?: { brandIntegrationId: string };
}

/**
 * Hook to subscribe to sync progress via Trigger.dev native realtime.
 * Uses useRealtimeRun to subscribe directly to the Trigger.dev run.
 */
export function useTriggerSyncProgress(
  runId: string | null,
  accessToken: string | null,
): {
  progress: SyncProgressMetadata | null;
  runStatus: string | null;
  error: Error | null;
} {
  const isEnabled = !!runId && !!accessToken;

  const { run, error } = useRealtimeRun(runId ?? "", {
    accessToken: accessToken ?? "",
    enabled: isEnabled,
  });

  // Extract sync progress from run metadata
  const progress = useMemo(() => {
    if (!run?.metadata?.syncProgress) return null;
    return run.metadata.syncProgress as unknown as SyncProgressMetadata;
  }, [run?.metadata?.syncProgress]);

  // Map Trigger.dev run status to our status type
  const runStatus = useMemo(() => {
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
      case "QUEUED":
      case "DEQUEUED":
      case "WAITING":
      case "DELAYED":
      case "PENDING_VERSION":
        return "pending";
      default:
        return String(run.status).toLowerCase();
    }
  }, [run?.status]);

  return { progress, runStatus, error: error ?? null };
}

// =============================================================================
// Legacy Supabase Realtime Hook (for promotion progress)
// =============================================================================

export interface UseJobProgressOptions {
  jobTypes?: JobProgressType[];
  contextFilter?: Record<string, unknown>;
  completedRetention?: number;
}

/**
 * Legacy hook for job progress via Supabase Realtime.
 * Still used for promotion progress (sync now uses Trigger.dev native realtime).
 */
export function useJobProgress(
  brandId: string | null,
  options: UseJobProgressOptions = {},
): {
  progress: JobProgressData | null;
  isConnected: boolean;
  clear: () => void;
} {
  const { jobTypes, contextFilter, completedRetention = 10000 } = options;

  const [progress, setProgress] = useState<JobProgressData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const retentionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use refs to avoid stale closures in the subscription callback
  const jobTypesRef = useRef(jobTypes);
  const contextFilterRef = useRef(contextFilter);
  const completedRetentionRef = useRef(completedRetention);

  // Keep refs in sync with latest values
  useEffect(() => {
    jobTypesRef.current = jobTypes;
    contextFilterRef.current = contextFilter;
    completedRetentionRef.current = completedRetention;
  }, [jobTypes, contextFilter, completedRetention]);

  const clear = useCallback(() => {
    setProgress(null);
    if (retentionTimerRef.current) {
      clearTimeout(retentionTimerRef.current);
      retentionTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!brandId) {
      setIsConnected(false);
      return;
    }

    const channel = supabase
      .channel(`job-progress:${brandId}`)
      .on("broadcast", { event: "progress" }, (message) => {
        const payload = message.payload as JobProgressData;

        // Apply filters using refs to avoid stale closures
        if (
          jobTypesRef.current?.length &&
          !jobTypesRef.current.includes(payload.jobType)
        )
          return;
        if (contextFilterRef.current && payload.context) {
          const matches = Object.entries(contextFilterRef.current).every(
            ([key, value]) => payload.context?.[key] === value,
          );
          if (!matches) return;
        }

        setProgress(payload);

        if (retentionTimerRef.current) {
          clearTimeout(retentionTimerRef.current);
          retentionTimerRef.current = null;
        }

        // Auto-clear for terminal states
        if (
          payload.status === "completed" ||
          payload.status === "failed" ||
          payload.status === "cancelled"
        ) {
          retentionTimerRef.current = setTimeout(() => {
            setProgress(null);
            retentionTimerRef.current = null;
          }, completedRetentionRef.current);
        }
      })
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
      setIsConnected(false);
      if (retentionTimerRef.current) {
        clearTimeout(retentionTimerRef.current);
        retentionTimerRef.current = null;
      }
    };
  }, [brandId, supabase]);

  return { progress, isConnected, clear };
}

// =============================================================================
// Convenience Hooks
// =============================================================================

/**
 * @deprecated Use useTriggerSyncProgress instead for sync progress.
 * This hook is kept for backwards compatibility but sync now uses Trigger.dev native realtime.
 */
export function useSyncProgress(
  brandId: string | null,
  brandIntegrationId: string | null,
) {
  const { progress, isConnected } = useJobProgress(brandId, {
    jobTypes: ["sync"],
    contextFilter: brandIntegrationId ? { brandIntegrationId } : undefined,
  });
  return { progress, isConnected };
}

export function usePromotionProgress(
  brandId: string | null,
  brandIntegrationId: string | null,
) {
  const { progress, isConnected } = useJobProgress(brandId, {
    jobTypes: ["promotion"],
    contextFilter: brandIntegrationId ? { brandIntegrationId } : undefined,
  });
  return { progress, isConnected };
}

export function useImportProgress(brandId: string | null) {
  const { progress, isConnected } = useJobProgress(brandId, {
    jobTypes: ["import"],
  });
  return { progress, isConnected };
}

