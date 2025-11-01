import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const queryClient = getQueryClient();

  // Prefetch composite workflow data to hydrate user, brands, and invites in one request
  const workflowInitOptions = trpc.composite.workflowInit.queryOptions();
  const workflowInit = await queryClient.fetchQuery(workflowInitOptions);

  queryClient.setQueryData(trpc.user.get.queryKey(), workflowInit.user);
  queryClient.setQueryData(trpc.workflow.list.queryKey(), workflowInit.brands);
  queryClient.setQueryData(
    trpc.user.invites.list.queryKey(),
    workflowInit.myInvites,
  );

  // Ensure user exists and has completed setup
  const user = workflowInit.user;

  if (!user) {
    redirect("/login");
  }

  if (!user.full_name) {
    redirect("/setup");
  }

  if (!user.brand_id) {
    redirect("/create-brand");
  }

  // Await params to access locale
  const { locale } = await params;

  return (
    <HydrateClient>
      <div className="relative h-full">
        <Header locale={locale} />
        <div className="flex flex-row justify-start h-[calc(100%-56px)]">
          <Sidebar />
          <div className="relative w-[calc(100%-56px)] h-full ml-[56px]">
            {children}
          </div>
        </div>
      </div>
    </HydrateClient>
  );
}
