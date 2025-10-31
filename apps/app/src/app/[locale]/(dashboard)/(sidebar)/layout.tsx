import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import {
  HydrateClient,
  batchPrefetch,
  getQueryClient,
  trpc,
} from "@/trpc/server";
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

  // Prefetch common data used across the dashboard
  await batchPrefetch([
    trpc.v2.user.get.queryOptions(),
    trpc.brand.list.queryOptions(),
  ]);

  // Fetch the user to ensure authentication and redirect if needed
  const user = await queryClient.fetchQuery(trpc.v2.user.get.queryOptions());

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
