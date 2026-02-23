import { cn } from "@v1/ui/cn";
import type * as React from "react";

export function EntityTableShell({
  title,
  toolbar,
  children,
  className,
}: {
  title: string;
  toolbar: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full h-full min-h-0", className)}>
      <div className="flex h-full min-h-0 flex-col gap-6">
        <h1 className="type-h4 text-primary">{title}</h1>
        {toolbar}
        <div className="flex-1 min-h-0">{children}</div>
      </div>
    </div>
  );
}
