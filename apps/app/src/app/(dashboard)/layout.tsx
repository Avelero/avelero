import { MainSkeleton } from "@/components/main-skeleton";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { cacheLife } from "next/cache";
import { Suspense } from "react";

/**
 * Dashboard Layout - Auth Bootstrap
 *
 * This layout handles authentication and cache seeding for ALL dashboard pages.
 * It does NOT include redirect logic - that's handled by (main)/layout.tsx
 * to avoid infinite redirect loops (since /setup, /create-brand, /invites
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
  "use cache: private";
  cacheLife("minutes");

  const queryClient = getQueryClient();

  // Single bootstrap fetch - handles authentication
  const workflowInit = await queryClient.fetchQuery(
    trpc.composite.workflowInit.queryOptions(),
  );

  const user = workflowInit.user;

  // Seed caches so child components don't refetch
  queryClient.setQueryData(trpc.user.get.queryOptions().queryKey, user);

  queryClient.setQueryData(
    trpc.workflow.list.queryOptions().queryKey,
    workflowInit.brands,
  );

  queryClient.setQueryData(
    trpc.user.invites.list.queryOptions().queryKey,
    workflowInit.myInvites,
  );

  return <HydrateClient>{children}</HydrateClient>;
}
