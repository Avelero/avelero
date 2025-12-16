"use client";

import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { useState } from "react";
import { SyncStatusBadge, formatDuration, formatSyncTime } from "./sync-status-badge";
import type { SyncJobRow, SyncJobStatus } from "./types";

interface SyncHistoryRowProps {
  job: SyncJobRow;
}

/**
 * Expandable row for a sync job.
 */
export function SyncHistoryRow({ job }: SyncHistoryRowProps) {
  const [expanded, setExpanded] = useState(false);
  const status = job.status as SyncJobStatus;
  const hasErrors = job.productsFailed > 0 || job.errorSummary;

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => hasErrors && setExpanded(!expanded)}
        className={cn(
          "w-full px-4 py-3 flex items-center justify-between text-left",
          hasErrors && "cursor-pointer hover:bg-accent/50",
          !hasErrors && "cursor-default",
        )}
      >
        <div className="flex items-center gap-4">
          <SyncStatusBadge status={status} />
          <div className="flex flex-col gap-0.5">
            <span className="text-foreground text-sm">
              {formatSyncTime(job.startedAt)}
            </span>
            <span className="text-secondary text-xs">
              {job.triggerType === "manual" ? "Manual" : "Scheduled"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Stats */}
          <div className="flex items-center gap-4 text-xs">
            {job.productsCreated > 0 && (
              <span className="text-green-600">+{job.productsCreated} created</span>
            )}
            {job.productsUpdated > 0 && (
              <span className="text-blue-600">{job.productsUpdated} updated</span>
            )}
            {job.productsSkipped > 0 && (
              <span className="text-secondary">{job.productsSkipped} skipped</span>
            )}
            {job.productsFailed > 0 && (
              <span className="text-destructive">{job.productsFailed} failed</span>
            )}
          </div>

          {/* Duration */}
          <span className="text-secondary text-xs w-16 text-right">
            {formatDuration(job.startedAt, job.finishedAt)}
          </span>

          {/* Expand icon */}
          {hasErrors && (
            <Icons.ChevronDown
              className={cn(
                "h-4 w-4 text-secondary transition-transform",
                expanded && "rotate-180",
              )}
            />
          )}
          {!hasErrors && <div className="w-4" />}
        </div>
      </button>

      {/* Expanded error details */}
      {expanded && hasErrors && (
        <div className="px-4 pb-4">
          <div className="bg-destructive/5 border border-destructive/20 p-3">
            <h6 className="text-destructive text-sm font-medium mb-2">
              Sync Errors
            </h6>
            {job.errorSummary ? (
              <pre className="text-xs text-secondary whitespace-pre-wrap font-mono overflow-x-auto">
                {job.errorSummary}
              </pre>
            ) : (
              <p className="text-secondary text-sm">
                {job.productsFailed} product{job.productsFailed > 1 ? "s" : ""} failed to sync.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}



