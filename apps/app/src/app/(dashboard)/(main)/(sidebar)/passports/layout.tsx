/**
 * Passports route gate.
 *
 * This layout prevents blocked brands from rendering any passports route tree,
 * which stops nested pages from issuing brand-scoped prefetches underneath the
 * content overlay.
 */
import { getDashboardInit, isSidebarContentBlocked } from "@/lib/brand-access";
import { connection } from "next/server";

export default async function PassportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolve access before nested passports pages start rendering.
  await connection();

  const initDashboard = await getDashboardInit();
  if (isSidebarContentBlocked(initDashboard.access.overlay)) {
    return null;
  }

  return children;
}
