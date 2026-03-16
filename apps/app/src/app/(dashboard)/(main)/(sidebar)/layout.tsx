/**
 * Sidebar layout chrome.
 *
 * This layout renders the shared dashboard shell and overlays blocked-brand
 * messaging inside the content area while keeping brand switching available.
 */
import { BlockedAccessScreen } from "@/components/access/blocked-access-screen";
import { PlanSelectorShell } from "@/components/billing/plan-selector-shell";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { isSidebarContentBlocked } from "@/lib/brand-access";
import { RealtimeWrapper } from "@/providers/realtime-wrapper";
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";
import { connection } from "next/server";

/**
 * Sidebar Layout - Chrome Rendering
 *
 * This layout renders the main application chrome (Header, Sidebar)
 * and import-related providers/dialogs.
 *
 * Auth bootstrap is handled by (dashboard)/layout.tsx.
 * Redirect logic is handled by (main)/layout.tsx.
 *
 * This layout also seeds the query cache for client components
 * (BrandDropdown, UserMenu, etc.) that need the user/brands data.
 */
export default async function SidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Signal that this component needs request-time data.
  await connection();

  const queryClient = getQueryClient();

  // Fetch data (will use cached result from parent layouts)
  const workflowInit = await queryClient.fetchQuery(
    trpc.composite.initDashboard.queryOptions(),
  );

  const access = workflowInit.access;
  const isBlocked = isSidebarContentBlocked(access.overlay);
  const blockedReason = isSidebarContentBlocked(access.overlay)
    ? access.overlay
    : access.overlay === "payment_required" && access.phase === "trial"
      ? "trial_expired"
      : null;

  // Seed caches for client components (Header, Sidebar, BrandDropdown, etc.)
  queryClient.setQueryData(
    trpc.user.get.queryOptions().queryKey,
    workflowInit.user,
  );

  queryClient.setQueryData(
    trpc.user.brands.list.queryOptions().queryKey,
    workflowInit.brands,
  );

  queryClient.setQueryData(
    trpc.user.invites.list.queryOptions().queryKey,
    workflowInit.myInvites,
  );

  // Skip notification fetches when brand access is blocked to avoid
  // ACCESS_CANCELLED errors that cause hydration warnings.
  if (workflowInit.activeBrand && !isBlocked) {
    await queryClient.fetchQuery(
      trpc.notifications.getUnreadCount.queryOptions(),
    );
    await queryClient.fetchQuery(
      trpc.notifications.getRecent.queryOptions({
        limit: 30,
        unreadOnly: false,
        includeDismissed: false,
      }),
    );
  }

  // HydrateClient transfers seeded cache data to Header/Sidebar client components.
  // Note: children (page content) has its own HydrateClient for page-specific data.
  return (
    <HydrateClient>
      <PlanSelectorShell>
        <div className="relative h-full">
          <Header disableNotifications={isBlocked} />
          <div className="flex flex-row justify-start h-[calc(100%_-_56px)]">
            <Sidebar />
            <div className="relative w-[calc(100%_-_56px)] h-full ml-[56px]">
              <RealtimeWrapper>
                {children}
                {blockedReason && workflowInit.activeBrand ? (
                  <BlockedAccessScreen
                    reason={blockedReason}
                    brandId={workflowInit.activeBrand.id}
                  />
                ) : null}
              </RealtimeWrapper>
            </div>
          </div>
        </div>
      </PlanSelectorShell>
    </HydrateClient>
  );
}
