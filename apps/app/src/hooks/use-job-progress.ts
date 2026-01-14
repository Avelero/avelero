"use client";

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

export interface UseJobProgressOptions {
  jobTypes?: JobProgressType[];
  contextFilter?: Record<string, unknown>;
  completedRetention?: number;
}

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
