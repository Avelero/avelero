import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
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

  if (workflowInit.activeBrand) {
    await queryClient.fetchQuery(trpc.notifications.getUnreadCount.queryOptions());
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
      <div className="relative h-full">
        <Header />
        <div className="flex flex-row justify-start h-[calc(100%_-_56px)]">
          <Sidebar />
          <div className="relative w-[calc(100%_-_56px)] h-full ml-[56px]">
            <RealtimeWrapper>{children}</RealtimeWrapper>
          </div>
        </div>
      </div>
    </HydrateClient>
  );
}
