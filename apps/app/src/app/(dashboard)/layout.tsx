import { MainSkeleton } from "@/components/main-skeleton";
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";
import { connection } from "next/server";
import { Suspense } from "react";

/**
 * Dashboard Layout - Auth Bootstrap
 *
 * This layout handles authentication and cache seeding for ALL dashboard pages.
 * It does NOT include redirect logic - that's handled by (main)/layout.tsx
 * to avoid infinite redirect loops (since /setup, /pending-access, /invites
 * are also under this layout).
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<MainSkeleton />}>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}

async function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  // Signal that this component needs request-time data.
  // Without this, Cache Components may prerender without request context.
  await connection();

  const queryClient = getQueryClient();

  // Single bootstrap fetch - handles authentication
  const initDashboard = await queryClient.fetchQuery(
    trpc.composite.initDashboard.queryOptions(),
  );

  const user = initDashboard.user;

  // Seed caches so child components don't refetch
  queryClient.setQueryData(trpc.user.get.queryOptions().queryKey, user);

  queryClient.setQueryData(
    trpc.user.brands.list.queryOptions().queryKey,
    initDashboard.brands,
  );

  queryClient.setQueryData(
    trpc.user.invites.list.queryOptions().queryKey,
    initDashboard.myInvites,
  );

  // HydrateClient transfers seeded cache data to client components.
  // Per TanStack docs, every layout/page that prefetches must have HydrateClient.
  return <HydrateClient>{children}</HydrateClient>;
}
