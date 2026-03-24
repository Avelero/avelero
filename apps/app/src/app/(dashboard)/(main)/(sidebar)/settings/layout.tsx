/**
 * Settings layout chrome.
 *
 * This layout renders the settings secondary navigation and blocks the entire
 * settings route tree when the active brand is cancelled or suspended.
 */
import { getDashboardInit, isSidebarContentBlocked } from "@/lib/brand-access";
import { SettingsSecondarySidebar } from "@/components/settings/settings-secondary-sidebar";
import { Skeleton } from "@v1/ui/skeleton";
import type { Metadata } from "next";
import { connection } from "next/server";
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

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolve access before rendering nested settings pages.
  await connection();

  const initDashboard = await getDashboardInit();
  if (isSidebarContentBlocked(initDashboard.access.overlay)) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0">
      <SettingsSecondarySidebar />
      <div className="flex min-h-0 min-w-0 flex-1">
        <div className="flex h-full min-h-0 w-full items-start justify-center overflow-y-auto p-8 scrollbar-hide">
          <Suspense fallback={<SettingsPageSkeleton />}>{children}</Suspense>
        </div>
      </div>
    </div>
  );
}
