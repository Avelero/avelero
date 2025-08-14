import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import {
  HydrateClient,
  batchPrefetch,
  getQueryClient,
  trpc,
} from "@/trpc/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
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
  batchPrefetch([
    trpc.user.me.queryOptions(),
    trpc.brand.list.queryOptions(),
  ]);

  // Fetch the user to ensure authentication and redirect if needed
  const user = await queryClient.fetchQuery(trpc.user.me.queryOptions());

  if (!user) {
    redirect("/login");
  }

  if (!user.full_name) {
    redirect("/setup");
  }

  if (!user.brand_id) {
    redirect("/brands/create");
  }

  // Get pathname from headers for navigation breadcrumbs
  const pathname = (await headers()).get('x-pathname') || '/';
  
  // Await params to access locale
  const { locale } = await params;

  return (
    <HydrateClient>
      <div className="relative">
        <Header pathname={pathname} locale={locale} />
        <div className="flex flex-row justify-start">
            <Sidebar />
            <div className="relative ml-[70px]">{children}</div>
        </div>
      </div>
    </HydrateClient>
  );
}