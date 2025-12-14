"use client";

/**
 * Loading skeleton for sync history table.
 */
export function SyncHistorySkeleton() {
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

/**
 * Loading skeleton for sync stats.
 */
export function SyncStatsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="border border-border p-4 animate-pulse">
          <div className="h-3 w-16 bg-accent mb-2" />
          <div className="h-5 w-24 bg-accent" />
        </div>
      ))}
    </div>
  );
}
