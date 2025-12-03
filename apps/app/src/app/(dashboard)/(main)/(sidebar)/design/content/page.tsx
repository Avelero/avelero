import { SetHeader } from "@/components/design/content/set-header";
import { SetMenu } from "@/components/design/content/set-menu";
import { SetCarousel } from "@/components/design/content/set-carousel";
import { SetBanner } from "@/components/design/content/set-banner";
import { SetFooter } from "@/components/design/content/set-footer";
import { Skeleton } from "@v1/ui/skeleton";
import { Suspense } from "react";
import { batchPrefetch, HydrateClient, trpc } from "@/trpc/server";
import { connection } from "next/server";

export default async function DesignPage() {
  await connection();

  batchPrefetch([
    trpc.workflow.list.queryOptions(),
    trpc.user.invites.list.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <div className="w-[500px]">
        <div className="flex flex-col gap-12">
          <Suspense fallback={<Skeleton className="h-[102px] w-full" />}>
            <SetHeader />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-[187px] w-full" />}>
            <SetMenu menuType="primary" />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-[187px] w-full" />}>
            <SetMenu menuType="secondary" />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-[187px] w-full" />}>
            <SetCarousel />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-[187px] w-full" />}>
            <SetBanner />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-[187px] w-full" />}>
            <SetFooter />
          </Suspense>
        </div>
      </div>
    </HydrateClient>
  );
}
