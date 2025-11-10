import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import {
  HydrateClient,
  batchPrefetch,
  getQueryClient,
  trpc,
} from "@/trpc/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic"; // To-do: Remove this once we have a proper solution for data hydration.

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = getQueryClient();

  batchPrefetch([
    trpc.workflow.list.queryOptions(),
    trpc.user.invites.list.queryOptions(),
  ]);

  const user = await queryClient.fetchQuery(trpc.user.get.queryOptions());

  if (!user) {
    redirect("/login");
  }

  if (!user.full_name) {
    redirect("/setup");
  }

  if (!user.brand_id) {
    redirect("/create-brand");
  }

  return (
    <HydrateClient>
      <div className="relative h-full">
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
