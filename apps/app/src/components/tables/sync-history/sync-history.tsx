"use client";

import { Icons } from "@v1/ui/icons";
import { SyncHistoryRow } from "./sync-history-row";
import { formatSyncTime } from "./sync-status-badge";
import type { SyncJobRow } from "./types";

interface SyncHistoryTableProps {
  jobs: SyncJobRow[];
  isLoading?: boolean;
}

/**
 * Table displaying sync job history.
 */
export function SyncHistoryTable({ jobs, isLoading }: SyncHistoryTableProps) {
  if (isLoading) {
    return (
      <div className="border border-border">
        <div className="divide-y divide-border">
          {[1, 2, 3].map((i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-4 animate-pulse">
              <div className="h-5 w-16 bg-accent" />
              <div className="flex flex-col gap-1 flex-1">
                <div className="h-4 w-32 bg-accent" />
                <div className="h-3 w-20 bg-accent" />
              </div>
              <div className="h-4 w-24 bg-accent" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="border border-dashed border-border p-8 flex flex-col items-center justify-center gap-2 text-center">
        <Icons.History className="h-8 w-8 text-secondary" />
        <p className="text-secondary text-sm">No sync history yet</p>
        <p className="text-tertiary text-xs">
          Sync history will appear here after the first sync.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-border">
      {jobs.map((job) => (
        <SyncHistoryRow key={job.id} job={job} />
      ))}
    </div>
  );
}

/**
 * Summary stats for recent syncs.
 */
export function SyncStats({
  lastSync,
  nextSync,
  totalSyncs,
}: {
  lastSync: string | null;
  nextSync: string | null;
  totalSyncs: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="border border-border p-4">
        <p className="text-secondary text-xs mb-1">Last Sync</p>
        <p className="text-foreground font-medium">
          {formatSyncTime(lastSync)}
        </p>
      </div>
      <div className="border border-border p-4">
        <p className="text-secondary text-xs mb-1">Next Sync</p>
        <p className="text-foreground font-medium">
          {nextSync ? formatSyncTime(nextSync) : "Not scheduled"}
        </p>
      </div>
      <div className="border border-border p-4">
        <p className="text-secondary text-xs mb-1">Total Syncs</p>
        <p className="text-foreground font-medium">{totalSyncs}</p>
      </div>
    </div>
  );
}



