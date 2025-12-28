"use client";

/**
 * ProductFormScaffold
 *
 * Layout wrapper for product create and edit forms.
 * - Wide column (600px) on LEFT (content/blocks)
 * - Narrow column (300px) on RIGHT (sidebar with status, identifiers)
 */

import { cn } from "@v1/ui/cn";

export function ProductFormScaffold({
  title,
  left,
  right,
  className,
  leftClassName,
  rightClassName,
}: {
  title: React.ReactNode;
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
  leftClassName?: string;
  rightClassName?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6 w-full max-w-[924px]", className)}>
      <p className="type-h4 text-primary">{title}</p>
      <div className="flex flex-row gap-6">
        <div
          className={cn(
            "flex flex-col gap-6 w-full max-w-[600px]",
            leftClassName,
          )}
        >
          {left}
        </div>
        <div
          className={cn(
            "flex flex-col gap-6 w-full max-w-[300px]",
            rightClassName,
          )}
        >
          {right}
        </div>
      </div>
    </div>
  );
}
