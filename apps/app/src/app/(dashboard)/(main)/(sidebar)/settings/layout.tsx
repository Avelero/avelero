import {
  ControlBar,
  ControlBarLeft,
  ControlBarNavButton,
  ControlBarRight,
} from "@/components/control-bar";
import { Skeleton } from "@v1/ui/skeleton";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Settings | Avelero",
};

/**
 * Generic skeleton for settings pages.
 * Shown during navigation while page prefetches complete.
 */
function SettingsPageSkeleton() {
  return (
    <div className="w-full max-w-[700px]">
      <div className="flex flex-col gap-12">
        <Skeleton className="h-[102px] w-full" />
        <Skeleton className="h-[187px] w-full" />
        <Skeleton className="h-[187px] w-full" />
      </div>
    </div>
  );
}

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full">
      <ControlBar>
        <ControlBarLeft>
          <ControlBarNavButton href="/settings" exact>
            General
          </ControlBarNavButton>
          <ControlBarNavButton href="/settings/members">
            Members
          </ControlBarNavButton>
          <ControlBarNavButton href="/settings/integrations">
            Integrations
          </ControlBarNavButton>
        </ControlBarLeft>
        <ControlBarRight />
      </ControlBar>
      <div className="flex w-full h-full justify-center items-start p-8 overflow-y-auto scrollbar-hide">
        <Suspense fallback={<SettingsPageSkeleton />}>{children}</Suspense>
      </div>
    </div>
  );
}
