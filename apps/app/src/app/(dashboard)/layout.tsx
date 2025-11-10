import { headers } from "next/headers";
import type { ReactNode } from "react";

export default async function DashboardSegmentLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Access headers to signal to Next.js that everything under the
  // dashboard segment depends on request-scope data (Supabase session).
  // This mirrors Midday's pattern and ensures dynamic rendering without
  // forcing each page to opt-in individually.
  await headers();

  return children;
}

