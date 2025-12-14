"use client";

import { cn } from "@v1/ui/cn";
import type { SyncJobStatus } from "./types";

type IntegrationStatus = "pending" | "active" | "error" | "paused" | "disconnected";

interface SyncStatusBadgeProps {
  status: SyncJobStatus;
  className?: string;
}

interface IntegrationStatusBadgeProps {
  status: IntegrationStatus;
  className?: string;
}

const syncStatusConfig: Record<
  SyncJobStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "bg-accent text-secondary",
  },
  running: {
    label: "Syncing",
    className: "bg-blue-500/10 text-blue-600",
  },
  completed: {
    label: "Completed",
    className: "bg-green-500/10 text-green-600",
  },
  failed: {
    label: "Failed",
    className: "bg-destructive/10 text-destructive",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-accent text-secondary",
  },
};

const integrationStatusConfig: Record<
  IntegrationStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "bg-accent text-secondary",
  },
  active: {
    label: "Active",
    className: "bg-green-500/10 text-green-600",
  },
  error: {
    label: "Error",
    className: "bg-destructive/10 text-destructive",
  },
  paused: {
    label: "Paused",
    className: "bg-yellow-500/10 text-yellow-600",
  },
  disconnected: {
    label: "Disconnected",
    className: "bg-accent text-secondary",
  },
};

/**
 * Badge showing sync job status.
 */
export function SyncStatusBadge({ status, className }: SyncStatusBadgeProps) {
  const config = syncStatusConfig[status] ?? syncStatusConfig.pending;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-xs font-medium",
        config.className,
        className,
      )}
    >
      {status === "running" && (
        <span className="mr-1.5 h-1.5 w-1.5 animate-pulse bg-blue-600" />
      )}
      {config.label}
    </span>
  );
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
        "inline-flex items-center px-2 py-0.5 text-xs font-medium",
        config.className,
        className,
      )}
    >
      {status === "active" && (
        <span className="mr-1.5 h-1.5 w-1.5 bg-green-600" />
      )}
      {status === "error" && (
        <span className="mr-1.5 h-1.5 w-1.5 bg-destructive" />
      )}
      {config.label}
    </span>
  );
}

/**
 * Formats a date for display in sync history.
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
