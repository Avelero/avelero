import { MainSkeleton } from "@/components/main-skeleton";
import {
  INVITE_REQUIRED_LOGIN_PATH,
  getForceSignOutPath,
} from "@/lib/auth-access";
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

/**
 * Dashboard Layout - Auth Bootstrap
 *
 * This layout handles authentication and cache seeding for ALL dashboard pages.
 * It includes invite-only guardrails that apply to every dashboard route.
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
  const brands = initDashboard.brands;
  const invites = initDashboard.myInvites;

  // Treat missing profile as invalid session.
  if (!user) {
    redirect("/login");
  }

  // Invite-only gate: users without memberships and pending invites are signed out.
  if (brands.length === 0 && invites.length === 0) {
    redirect(getForceSignOutPath(INVITE_REQUIRED_LOGIN_PATH));
  }

  // Seed caches so child components don't refetch
  queryClient.setQueryData(trpc.user.get.queryOptions().queryKey, user);

  queryClient.setQueryData(
    trpc.user.brands.list.queryOptions().queryKey,
    brands,
  );

  queryClient.setQueryData(
    trpc.user.invites.list.queryOptions().queryKey,
    invites,
  );

  // HydrateClient transfers seeded cache data to client components.
  // Per TanStack docs, every layout/page that prefetches must have HydrateClient.
  return <HydrateClient>{children}</HydrateClient>;
}
