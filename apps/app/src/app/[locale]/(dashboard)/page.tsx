import { SignOut } from "@/components/auth/sign-out";
import { TestingControls } from "@/components/debug/testing-controls";
import { getI18n } from "@/locales/server";
import { getUser } from "@v1/supabase/queries";

export const metadata = {
  title: "Home",
};

export default async function Page() {
  const { data } = await getUser();
  const t = await getI18n();

  return (
    <div className="min-h-screen w-full flex flex-col">
      <TestingControls />
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p>{t("welcome", { name: data?.user?.email })}</p>

        <SignOut />
      </div>
    </div>
  );
}
