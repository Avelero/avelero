"use client";

import { Skeleton } from "@v1/ui/skeleton";

export function MembersSkeleton() {
  return (
    <div className="p-4 space-y-2">
      {["a", "b", "c"].map((k) => (
        <div
          key={`members-skel-${k}`}
          className="flex items-center justify-between p-3 border rounded"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-4 w-40" />
        </div>
      ))}
    </div>
  );
}
