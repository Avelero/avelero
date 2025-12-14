"use client";

/**
 * Loading skeleton for field mapping table.
 */
export function FieldMappingSkeleton() {
  return (
    <div className="border border-border">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="px-4 py-3 flex items-center gap-4 border-b border-border last:border-b-0 animate-pulse"
        >
          <div className="h-5 w-9 bg-accent" />
          <div className="flex flex-col gap-1 flex-1">
            <div className="h-4 w-32 bg-accent" />
            <div className="h-3 w-24 bg-accent" />
          </div>
          <div className="h-9 w-[180px] bg-accent" />
        </div>
      ))}
    </div>
  );
}
