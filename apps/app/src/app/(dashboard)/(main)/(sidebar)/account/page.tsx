import { DeleteAccount } from "@/components/account/delete-account";
import { SetAvatar } from "@/components/account/set-avatar";
import { SetEmail } from "@/components/account/set-email";
import { SetName } from "@/components/account/set-name";
import { Skeleton } from "@v1/ui/skeleton";
import { Suspense } from "react";
import { batchPrefetch, HydrateClient, trpc } from "@/trpc/server";
import { connection } from "next/server";

export default async function AccountPage() {
  await connection();

  batchPrefetch([
    trpc.workflow.list.queryOptions(),
    trpc.user.invites.list.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <div className="w-[700px]">
        <div className="flex flex-col gap-12">
          <Suspense fallback={<Skeleton className="h-[102px] w-full" />}>
            <SetAvatar />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-[187px] w-full" />}>
            <SetName />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-[187px] w-full" />}>
            <SetEmail />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-[102px] w-full" />}>
            <DeleteAccount />
          </Suspense>
        </div>
      </div>
    </HydrateClient>
  );
}
