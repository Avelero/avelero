import { ThemeContentForm } from "@/components/design/content/theme-content-form";
import { Skeleton } from "@v1/ui/skeleton";
import { Suspense } from "react";
import { batchPrefetch, HydrateClient, trpc } from "@/trpc/server";
import { connection } from "next/server";

export default async function DesignContentPage() {
  await connection();

  batchPrefetch([
    trpc.workflow.getTheme.queryOptions(),
    trpc.workflow.list.queryOptions(),
    trpc.user.invites.list.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <Suspense fallback={<ContentSkeleton />}>
        <ThemeContentForm />
          </Suspense>
    </HydrateClient>
  );
}

function ContentSkeleton() {
  return (
    <div className="w-[500px]">
      <div className="flex justify-end mb-6">
        <Skeleton className="h-9 w-16" />
      </div>
      <div className="flex flex-col gap-12">
        <Skeleton className="h-[102px] w-full" />
        <Skeleton className="h-[187px] w-full" />
        <Skeleton className="h-[187px] w-full" />
        <Skeleton className="h-[187px] w-full" />
        <Skeleton className="h-[187px] w-full" />
        <Skeleton className="h-[187px] w-full" />
      </div>
    </div>
  );
}
