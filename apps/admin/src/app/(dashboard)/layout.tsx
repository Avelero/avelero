import { Header } from "@/components/header";
import { MainSkeleton } from "@/components/main-skeleton";
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

function DashboardLayoutSkeleton() {
  return <MainSkeleton />;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<DashboardLayoutSkeleton />}>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}

async function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();

  const queryClient = getQueryClient();

  try {
    await queryClient.fetchQuery(trpc.platformAdmin.viewer.get.queryOptions());
  } catch {
    redirect("/login?error=auth-failed");
  }

  return (
    <HydrateClient>
      <div className="relative h-full">
        <Header />
        <main className="h-[calc(100%_-_56px)] overflow-y-auto p-8 scrollbar-hide">
          {children}
        </main>
      </div>
    </HydrateClient>
  );
}
