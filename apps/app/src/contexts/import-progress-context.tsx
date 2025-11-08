"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

//===================================================================================
// TYPES & INTERFACES
//===================================================================================

type ImportStatus =
  | "PENDING"
  | "VALIDATING"
  | "VALIDATED"
  | "COMMITTING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

interface ImportProgress {
  current: number;
  total: number;
  created: number;
  updated: number;
  failed: number;
  percentage: number;
}

interface ImportState {
  jobId: string | null;
  status: ImportStatus | null;
  progress: ImportProgress;
  filename: string;
}

interface ImportProgressContextValue {
  state: ImportState;
  startImport: (jobId: string, filename: string) => void;
  cancelImport: () => void;
  dismissWidget: () => void;
  openReviewDialog: () => void;
  closeReviewDialog: () => void;
  reviewDialogOpen: boolean;
}

//===================================================================================
// CONSTANTS
//===================================================================================

const STORAGE_KEY = "avelero_import_progress";
const POLL_INTERVAL = 2000; // 2 seconds

const INITIAL_STATE: ImportState = {
  jobId: null,
  status: null,
  progress: {
    current: 0,
    total: 0,
    created: 0,
    updated: 0,
    failed: 0,
    percentage: 0,
  },
  filename: "",
};

//===================================================================================
// CONTEXT
//===================================================================================

const ImportProgressContext = createContext<
  ImportProgressContextValue | undefined
>(undefined);

//===================================================================================
// HELPER FUNCTIONS
//===================================================================================

/**
 * Check if import status is active (should poll for updates)
 */
function isActiveStatus(status: ImportStatus | null): boolean {
  return (
    status === "PENDING" ||
    status === "VALIDATING" ||
    status === "COMMITTING"
  );
}

/**
 * Load state from localStorage
 */
function loadStateFromStorage(): ImportState {
  if (typeof window === "undefined") return INITIAL_STATE;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return INITIAL_STATE;

    const parsed = JSON.parse(stored) as ImportState;

    // Don't restore completed/failed/cancelled states
    if (
      parsed.status === "COMPLETED" ||
      parsed.status === "FAILED" ||
      parsed.status === "CANCELLED"
    ) {
      return INITIAL_STATE;
    }

    return parsed;
  } catch (error) {
    console.error("Failed to load import state from localStorage:", error);
    return INITIAL_STATE;
  }
}

/**
 * Save state to localStorage
 */
function saveStateToStorage(state: ImportState): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Failed to save import state to localStorage:", error);
  }
}

/**
 * Clear state from localStorage
 */
function clearStateFromStorage(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear import state from localStorage:", error);
  }
}

//===================================================================================
// PROVIDER COMPONENT
//===================================================================================

interface ImportProgressProviderProps {
  children: ReactNode;
}

export function ImportProgressProvider({
  children,
}: ImportProgressProviderProps) {
  const trpc = useTRPC();

  // Initialize state from localStorage
  const [state, setState] = useState<ImportState>(INITIAL_STATE);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

  // Load state from localStorage on mount
  useEffect(() => {
    const storedState = loadStateFromStorage();
    if (storedState.jobId) {
      console.log("[ImportProgress] Restored from storage:", storedState);
      setState(storedState);
    }
  }, []);

  // Log when polling is enabled/disabled
  useEffect(() => {
    const pollingEnabled = !!state.jobId && isActiveStatus(state.status);
    console.log("[ImportProgress] Polling status:", {
      enabled: pollingEnabled,
      jobId: state.jobId,
      status: state.status,
      interval: `${POLL_INTERVAL}ms`,
    });
  }, [state.jobId, state.status]);

  // Poll for import status when job is active
  const { data: statusData } = useQuery({
    ...trpc.bulk.getImportStatus.queryOptions({ jobId: state.jobId as string }),
    enabled: !!state.jobId && isActiveStatus(state.status),
    refetchInterval: POLL_INTERVAL,
    retry: true,
    retryDelay: 2000,
  });

  // Update state when status data changes
  useEffect(() => {
    if (!statusData) {
      console.log("[ImportProgress] No status data received");
      return;
    }

    console.log("[ImportProgress] Status update received:", {
      jobId: statusData.jobId,
      status: statusData.status,
      progress: statusData.progress,
    });

    const newState: ImportState = {
      jobId: statusData.jobId,
      status: statusData.status as ImportStatus,
      progress: {
        current: statusData.progress.processed,
        total: statusData.progress.total,
        created: statusData.progress.created,
        updated: statusData.progress.updated,
        failed: statusData.progress.failed,
        percentage: statusData.progress.percentage,
      },
      filename: statusData.filename,
    };

    setState(newState);
    saveStateToStorage(newState);

    // Auto-open review dialog when validation complete
    if (statusData.status === "VALIDATED") {
      console.log("[ImportProgress] Validation complete - opening review dialog");
      setReviewDialogOpen(true);
    }

    // Auto-dismiss widget after completion (5 seconds)
    if (statusData.status === "COMPLETED") {
      console.log("[ImportProgress] Import complete - auto-dismissing in 5s");
      setTimeout(() => {
        dismissWidget();
      }, 5000);
    }
  }, [statusData]);

  // Timeout detection for stuck jobs
  useEffect(() => {
    if (!state.jobId || state.status !== "PENDING") return;

    // If job is stuck in PENDING for more than 30 seconds, show warning
    const timeoutId = setTimeout(() => {
      console.warn(
        "[ImportProgress] Job stuck in PENDING status - Trigger.dev may not be running",
      );
    }, 30000);

    return () => clearTimeout(timeoutId);
  }, [state.jobId, state.status]);

  // Persist state to localStorage whenever it changes
  useEffect(() => {
    if (state.jobId) {
      saveStateToStorage(state);
    }
  }, [state]);

  /**
   * Start a new import job
   */
  const startImport = useCallback((jobId: string, filename: string) => {
    console.log("[ImportProgress] Starting new import:", { jobId, filename });

    const newState: ImportState = {
      jobId,
      status: "PENDING",
      progress: {
        current: 0,
        total: 0,
        created: 0,
        updated: 0,
        failed: 0,
        percentage: 0,
      },
      filename,
    };

    setState(newState);
    saveStateToStorage(newState);

    console.log("[ImportProgress] Import started - polling will begin");
  }, []);

  /**
   * Cancel the current import job
   */
  const cancelImport = useCallback(() => {
    if (!state.jobId) return;

    // Update local state immediately
    setState((prev) => ({
      ...prev,
      status: "CANCELLED",
    }));

    // Clear from storage
    clearStateFromStorage();

    // Close review dialog if open
    setReviewDialogOpen(false);
  }, [state.jobId]);

  /**
   * Dismiss the floating widget
   */
  const dismissWidget = useCallback(() => {
    setState(INITIAL_STATE);
    clearStateFromStorage();
    setReviewDialogOpen(false);
  }, []);

  /**
   * Open review dialog
   */
  const openReviewDialog = useCallback(() => {
    setReviewDialogOpen(true);
  }, []);

  /**
   * Close review dialog
   */
  const closeReviewDialog = useCallback(() => {
    setReviewDialogOpen(false);
  }, []);

  const contextValue: ImportProgressContextValue = {
    state,
    startImport,
    cancelImport,
    dismissWidget,
    openReviewDialog,
    closeReviewDialog,
    reviewDialogOpen,
  };

  return (
    <ImportProgressContext.Provider value={contextValue}>
      {children}
    </ImportProgressContext.Provider>
  );
}

//===================================================================================
// HOOK
//===================================================================================

/**
 * Hook to access import progress context
 * @throws Error if used outside of ImportProgressProvider
 */
export function useImportProgress(): ImportProgressContextValue {
  const context = useContext(ImportProgressContext);

  if (context === undefined) {
    throw new Error(
      "useImportProgress must be used within ImportProgressProvider",
    );
  }

  return context;
}

//===================================================================================
// EXPORTS
//===================================================================================

export type { ImportState, ImportStatus, ImportProgress };
