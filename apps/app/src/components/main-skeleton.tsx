"use client";

import dashboardAnimation from "@/animations/avelero-icon-animation.json";
import { cn } from "@v1/ui/cn";
import { LordIcon } from "@v1/ui/lord-icon";

export function MainSkeleton() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
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
