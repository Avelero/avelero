"use client";

/**
 * VariantFormScaffold
 *
 * Layout wrapper for the variant edit page with FLIPPED columns
 * compared to the product form scaffold.
 *
 * - Narrow column (300px) on LEFT (sidebar with variant overview)
 * - Wide column (600px) on RIGHT (content/blocks)
 */

import { cn } from "@v1/ui/cn";

export function VariantFormScaffold({
  header,
  sidebar,
  content,
  className,
}: {
  header: React.ReactNode;
  sidebar: React.ReactNode;
  content: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6 w-full max-w-[924px]", className)}>
      {header}
      <div className="flex flex-row gap-6">
        {/* Narrow sidebar on LEFT */}
        <div className="flex flex-col gap-6 w-full max-w-[300px] shrink-0">
          {sidebar}
        </div>
        {/* Wide content on RIGHT */}
        <div className="flex flex-col gap-6 w-full max-w-[600px]">
          {content}
        </div>
      </div>
    </div>
  );
}
