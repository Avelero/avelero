import { DeleteAccount } from "@/components/account/delete-account";
import { SetAvatar } from "@/components/account/set-avatar";
import { SetEmail } from "@/components/account/set-email";
import { SetName } from "@/components/account/set-name";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import { connection } from "next/server";

export default async function AccountPage() {
  await connection();

  batchPrefetch([
    trpc.user.brands.list.queryOptions(),
    trpc.user.invites.list.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <div className="w-[700px]">
        <div className="flex flex-col gap-12">
          <SetAvatar />
          <SetName />
          <SetEmail />
          <DeleteAccount />
        </div>
      </div>
    </HydrateClient>
  );
}
