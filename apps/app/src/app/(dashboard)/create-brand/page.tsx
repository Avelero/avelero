import { isPlatformAdminEmail } from "@/lib/platform-admin";
import { createClient } from "@v1/supabase/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Create a brand | Avelero",
};

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isPlatformAdminEmail(user?.email)) {
    redirect("/admin/brands/new");
  }

  redirect("/pending-access");
}
