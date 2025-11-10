import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = getQueryClient();

  // Access request headers to mark this segment as dynamic without disabling cache reuse.
  const requestHeaders = await headers();
  const isInternalClientRequest =
    requestHeaders.get("user-agent")?.includes("AveleroInternal") ?? false;

  // Fetch composite workflow data (user + brand memberships) similar to Midday's layout bootstrap.
  const workflowData = await queryClient.fetchQuery(
    trpc.composite.workflowInit.queryOptions(),
  );

  const user = workflowData?.user ?? null;
  const brands = workflowData?.brands ?? [];

  // Prime individual caches so client-side hooks reuse hydrated data instead of refetching.
  queryClient.setQueryData(trpc.user.get.queryKey(), user);
  queryClient.setQueryData(trpc.workflow.list.queryKey(), brands);

  if (!user) {
    redirect("/login");
  }

  if (!user.full_name) {
    redirect("/setup");
  }

  if (!user.brand_id) {
    redirect("/create-brand");
  }

  // Wrap in HydrateClient to dehydrate prefetched data
  // Following Midday's pattern: layout provides shared data hydration
  return (
    <HydrateClient>
      <div
        className="relative h-full"
        data-internal-client={isInternalClientRequest ? "true" : "false"}
      >
        <Header />
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
