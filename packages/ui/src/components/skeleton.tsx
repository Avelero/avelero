import type * as React from "react";
import { cn } from "../utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-none",
        "bg-accent animate-pulse",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
