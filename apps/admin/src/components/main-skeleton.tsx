"use client";

import dashboardAnimation from "@/animations/avelero-icon-animation.json";
import { cn } from "@v1/ui/cn";
import { LordIcon } from "@v1/ui/lord-icon";

interface MainSkeletonProps {
  className?: string;
  contained?: boolean;
}

export function MainSkeleton({
  className,
  contained = false,
}: MainSkeletonProps) {
  return (
    <div
      className={cn(
        contained
          ? "flex h-full w-full items-center justify-center bg-background"
          : "flex h-screen w-screen items-center justify-center bg-background",
        className,
      )}
    >
      <div className={cn("flex flex-col items-center gap-4 text-primary")}>
        <LordIcon
          animationData={dashboardAnimation}
          style={{ width: 48, height: 48 }}
          loop
          autoplay
        />
      </div>
    </div>
  );
}
