import { Header } from "@/components/header";
import { FloatingProgressWidget } from "@/components/import/floating-progress-widget";
import { ImportReviewDialog } from "@/components/import/import-review-dialog";
import { MainSkeleton } from "@/components/main-skeleton";
import { Sidebar } from "@/components/sidebar";
import { ImportProgressProvider } from "@/contexts/import-progress-context";
import { batchPrefetch, getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { cacheLife } from "next/cache";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default function SidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<MainSkeleton />}>
      <SidebarLayoutContent>{children}</SidebarLayoutContent>
    </Suspense>
  );
}

async function SidebarLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureWorkflowSetup();

  await batchPrefetch([
    trpc.user.get.queryOptions(),
    trpc.workflow.list.queryOptions(),
  ]);

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

async function ensureWorkflowSetup() {
  "use cache: private";
  cacheLife("hours");

  const queryClient = getQueryClient();
  
  const workflowInit = await queryClient.fetchQuery(
    trpc.composite.workflowInit.queryOptions(),
  );

  const user = workflowInit.user;

  if (!user?.full_name) redirect("/setup");
  if (!user?.brand_id) redirect("/create-brand");
}
