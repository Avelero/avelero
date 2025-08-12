import { SignOut } from "@/components/auth/sign-out";
import { TestingControls } from "@/components/debug/testing-controls";
import { InviteModal } from "@/components/modals/invite-modal";
import { InvitesTable } from "@/components/invites-table";
import { getI18n } from "@/locales/server";
import { getUserProfile } from "@v1/supabase/queries";

export const metadata = {
  title: "Home",
};

export default async function Page() {
  const { data } = await getUserProfile();
  const t = await getI18n();

  return (
    <div className="min-h-screen w-full flex flex-col">
      <TestingControls />
      {data?.brand_id ? (
        <div className="px-6 pb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Invitations</h2>
            <InviteModal brandId={data.brand_id} />
          </div>
          <div className="mt-3">
            <InvitesTable brandId={data.brand_id} />
          </div>
        </div>
      ) : null}
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p>{t("welcome", { name: data?.email })}</p>

        <SignOut />
      </div>
    </div>
  );
}
