import { DeleteBrand } from "@/components/settings/delete-brand";
import { SetCountry } from "@/components/settings/set-country";
import { SetDomain } from "@/components/settings/set-domain";
import { SetEmail } from "@/components/settings/set-email";
import { SetLogo } from "@/components/settings/set-logo";
import { SetName } from "@/components/settings/set-name";
import { SetSlug } from "@/components/settings/set-slug";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import { connection } from "next/server";

export default async function SettingsPage() {
  await connection();

  await batchPrefetch([
    trpc.user.brands.list.queryOptions(),
    trpc.composite.membersWithInvites.queryOptions({}),
    trpc.brand.customDomains.get.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <div className="w-[700px]">
        <div className="flex flex-col gap-12">
          <SetLogo />
          <SetName />
          <SetSlug />
          <SetEmail />
          <SetCountry />
          <SetDomain />
          <DeleteBrand />
        </div>
      </div>
    </HydrateClient>
  );
}
