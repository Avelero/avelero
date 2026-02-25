import { Header } from "@/components/header";
import { isPlatformAdminEmail } from "@/lib/platform-admin";
import { createClient } from "@v1/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isPlatformAdminEmail(user?.email)) {
    redirect("/pending-access");
  }

  return (
    <div className="h-full w-full overflow-y-auto">
      <Header hideUserMenu disableLogoLink />
      <main className="mx-auto w-full max-w-[980px] px-4 py-6">{children}</main>
    </div>
  );
}
