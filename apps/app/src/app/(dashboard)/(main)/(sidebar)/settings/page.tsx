import { DeleteBrand } from "@/components/settings/delete-brand";
import { SetCountry } from "@/components/settings/set-country";
import { SetEmail } from "@/components/settings/set-email";
import { SetLogo } from "@/components/settings/set-logo";
import { SetName } from "@/components/settings/set-name";
import { SetSlug } from "@/components/settings/set-slug";
import { batchPrefetch, HydrateClient, trpc } from "@/trpc/server";
import { Skeleton } from "@v1/ui/skeleton";
import { Suspense } from "react";
import { connection } from "next/server";

export default async function SettingsPage() {
  await connection();

  batchPrefetch([
    trpc.workflow.list.queryOptions(),
    trpc.composite.membersWithInvites.queryOptions({}),
  ]);

  return (
    <HydrateClient>
      <div className="w-[700px]">
        <div className="flex flex-col gap-12">
          <Suspense fallback={<Skeleton className="h-[102px] w-full" />}>
            <SetLogo />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-[187px] w-full" />}>
            <SetName />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-[187px] w-full" />}>
            <SetSlug />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-[207px] w-full" />}>
            <SetEmail />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-[187px] w-full" />}>
            <SetCountry />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-[102px] w-full" />}>
            <DeleteBrand />
          </Suspense>
        </div>
      </div>
    </HydrateClient>
  );
}
