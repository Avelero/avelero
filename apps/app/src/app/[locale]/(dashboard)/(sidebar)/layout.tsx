import { getQueryClient, trpc } from "@/trpc/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { FloatingProgressWidget } from "@/components/import/floating-progress-widget";
import { ImportReviewDialog } from "@/components/import/import-review-dialog";
import { Sidebar } from "@/components/sidebar";
import { ImportProgressProvider } from "@/contexts/import-progress-context";
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function SidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = getQueryClient();
  
  // Fetch complete workflow data (user, brands, invites)
  // Parent layout already fetched basic user.get, this will fetch the composite
  const workflowInit = await queryClient.fetchQuery(
    trpc.composite.workflowInit.queryOptions()
  );
  
  const user = workflowInit.user;
  
  // Redirect to complete setup if needed
  if (!user?.full_name) {
    redirect("/setup");
  }
  
  if (!user?.brand_id) {
    redirect("/create-brand");
  }
  
  // Populate cache for all sidebar routes
  queryClient.setQueryData(trpc.workflow.list.queryKey(), workflowInit.brands);
  queryClient.setQueryData(
    trpc.user.invites.list.queryKey(),
    workflowInit.myInvites,
  );
  
  return (
    <HydrateClient>
      <ImportProgressProvider>
        <div className="relative h-full">
          <Header />
          <div className="flex flex-row justify-start h-[calc(100%-56px)]">
            <Sidebar />
            <div className="relative w-[calc(100%-56px)] h-full ml-[56px]">
              {children}
            </div>
          </div>
          <FloatingProgressWidget />
          <ImportReviewDialog />
        </div>
      </ImportProgressProvider>
    </HydrateClient>
  );
}