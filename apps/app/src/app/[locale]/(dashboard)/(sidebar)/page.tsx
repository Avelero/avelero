import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | Avelero",
};

export default async function DashboardPage() {
  const queryClient = getQueryClient();
  
  // Re-fetch workflowInit (instant cache hit from sidebar layout)
  // This gives Next.js something substantial to cache, preventing RSC refetches
  await queryClient.fetchQuery(
    trpc.composite.workflowInit.queryOptions()
  );
  
  return (
    <div className="flex justify-center items-center relative">
      <div className="text-2xl font-bold">Dashboard</div>
    </div>
  );
}
