import { HydrateClient, trpc } from "@/trpc/server";
import { getQueryClient } from "@/trpc/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | Avelero",
};

export default async function DashboardPage() {
  const queryClient = getQueryClient();

  // Get current user for basic info (already prefetched in layout)
  const user = await queryClient.fetchQuery(trpc.user.me.queryOptions());

  return (
    <HydrateClient>
      <div className="flex justify-center items-center relative">
        <div className="text-2xl font-bold">Dashboard</div>
      </div>
    </HydrateClient>
  );
}
