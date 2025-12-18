"use client";

import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";

// =============================================================================
// Types
// =============================================================================

export type IntegrationStatus = "pending" | "active" | "error" | "paused" | "disconnected";
export type SyncJobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

// =============================================================================
// Status Badge
// =============================================================================

const integrationStatusConfig: Record<
  IntegrationStatus,
  { label: string }
> = {
  pending: {
    label: "Pending",
  },
  active: {
    label: "Active",
  },
  error: {
    label: "Error",
  },
  paused: {
    label: "Paused",
  },
  disconnected: {
    label: "Disconnected",
  },
};

interface IntegrationStatusBadgeProps {
  status: IntegrationStatus;
  className?: string;
}

/**
 * Badge showing integration connection status.
 */
export function IntegrationStatusBadge({
  status,
  className,
}: IntegrationStatusBadgeProps) {
  const config = integrationStatusConfig[status] ?? integrationStatusConfig.pending;

  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 h-6 rounded-full border border-border bg-background",
        className,
      )}
    >
      {status === "active" && (
        <div className="flex h-3 w-3 items-center justify-center">
            <span className="h-2 w-2 rounded-full bg-brand" />
        </div>
      )}
      {status === "error" && (
        <div className="flex h-3 w-3 items-center justify-center">
            <span className="h-2 w-2 rounded-full bg-destructive" />
        </div>
      )}
      <span className="type-small text-foreground px-1">{config.label}</span>
    </span>
  );
}

// =============================================================================
// Sync Progress Block
// =============================================================================

interface SyncProgressBlockProps {
  /** Current sync job status */
  status: SyncJobStatus | null;
  /** Sync progress percentage (0-100) */
  progress?: number;
  /** When the sync started */
  startedAt: string | null;
  /** Error message if sync failed */
  errorMessage?: string | null;
}

/**
 * Progress block showing current sync status with a progress bar.
 */
export function SyncProgressBlock({
  status,
  progress,
  startedAt,
  errorMessage,
}: SyncProgressBlockProps) {
  const isInProgress = status === "pending" || status === "running";
  const isFailed = status === "failed";
  const isCompleted = status === "completed";

  // Show indeterminate state when in progress but no percentage available
  const isIndeterminate = isInProgress && progress === undefined;
  const displayProgress = progress ?? (isCompleted ? 100 : isFailed ? 100 : 0);

  return (
    <div className="border border-border p-4 flex flex-col gap-2">
      {/* Status header */}
      <div className="flex items-center justify-between">
        <span className="type-small !font-medium text-foreground">
          {isInProgress && "In progress"}
          {isCompleted && "Completed"}
          {isFailed && "Failed"}
          {!status && "No sync"}
        </span>
        {status && !isIndeterminate && (
          <span className="type-small text-secondary">{displayProgress}%</span>
        )}
      </div>

      {/* Progress bar */}
      {status && (
        <div className="h-3 bg-[#0000FF]/10 w-full overflow-hidden">
          {isIndeterminate ? (
            <div className="h-full w-1/3 bg-brand animate-indeterminate" />
          ) : (
            <div
              className={cn(
                "h-full transition-all duration-300",
                isFailed ? "bg-destructive" : "bg-brand",
              )}
              style={{ width: `${displayProgress}%` }}
            />
          )}
        </div>
      )}

      {/* Sync start time */}
      {startedAt && (
        <p className="type-small text-secondary">
          Sync started on {formatFullDateTime(startedAt)}
        </p>
      )}

      {/* Error message */}
      {isFailed && errorMessage && (
        <p className="type-small text-destructive mt-1">{errorMessage}</p>
      )}
    </div>
  );
}

// =============================================================================
// Integration Info Header
// =============================================================================

interface IntegrationInfoRowProps {
  lastSync: string | null;
  nextSync: string | null;
  status: IntegrationStatus;
}

/**
 * Row showing last sync, next sync, and status info.
 */
export function IntegrationInfoRow({
  lastSync,
  nextSync,
  status,
}: IntegrationInfoRowProps) {
  return (
    <div className="flex flex-row items-start gap-4 mx-4">
      <div className="flex flex-col items-start gap-2">
        <span className="type-small h-6 text-secondary flex items-center">Last sync</span>
        <span className="type-small h-6 text-secondary flex items-center">Next sync</span>
        <span className="type-small h-6 text-secondary flex items-center">Status</span>
      </div>
      <div className="flex flex-col items-start gap-2">
        <div className="flex items-center pl-1.5 h-6 pr-1">
          <Icons.Calendar className="h-3 w-3 text-secondary" />
          <span className="type-small text-foreground pl-1">{formatFullDateTime(lastSync)}</span>
        </div>
        <div className="flex items-center pl-1.5 h-6 pr-1">
          <Icons.Calendar className="h-3 w-3 text-secondary" />
          <span className="type-small text-foreground pl-1">{nextSync ? formatFullDateTime(nextSync) : "Not scheduled"}</span>
        </div>
        <IntegrationStatusBadge status={status} />
      </div>
    </div>
  );
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Formats a date for relative display (e.g., "2h ago").
 */
export function formatSyncTime(date: string | Date | null): string {
  if (!date) return "Never";

  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/**
 * Formats a date for full display (e.g., "18 December 2025 at 15:41").
 */
export function formatFullDateTime(date: string | Date | null): string {
  if (!date) return "Never";

  const d = typeof date === "string" ? new Date(date) : date;

  const datePart = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timePart = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datePart} at ${timePart}`;
}

/**
 * Formats sync duration in human readable format.
 */
export function formatDuration(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt || !finishedAt) return "-";

  const start = new Date(startedAt);
  const end = new Date(finishedAt);
  const diffMs = end.getTime() - start.getTime();

  if (diffMs < 1000) return "<1s";
  if (diffMs < 60000) return `${Math.floor(diffMs / 1000)}s`;
  if (diffMs < 3600000) {
    const mins = Math.floor(diffMs / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }

  const hours = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

