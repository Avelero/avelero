/**
 * Shared access helpers for dashboard route gating.
 *
 * These helpers centralize the dashboard access lookup so server layouts can
 * consistently block protected content areas before nested pages start
 * prefetching brand-scoped data.
 */
import "server-only";

import { getQueryClient, trpc } from "@/trpc/server";

type DashboardOverlay =
  | "none"
  | "payment_required"
  | "suspended"
  | "temporary_blocked"
  | "cancelled";

/**
 * Loads the cached dashboard bootstrap payload for the current request.
 */
export async function getDashboardInit() {
  const queryClient = getQueryClient();
  return queryClient.fetchQuery(trpc.composite.initDashboard.queryOptions());
}

/**
 * Checks whether the current access state should fully block sidebar content.
 */
export function isSidebarContentBlocked(
  overlay: DashboardOverlay | null | undefined,
): overlay is "suspended" | "temporary_blocked" | "cancelled" {
  return (
    overlay === "suspended" ||
    overlay === "temporary_blocked" ||
    overlay === "cancelled"
  );
}

/**
 * Resolves whether the current sidebar content route should render at all.
 */
export async function shouldBlockSidebarContent(): Promise<boolean> {
  const initDashboard = await getDashboardInit();
  return isSidebarContentBlocked(initDashboard.access.overlay);
}
