"use client";

import { useParams, useRouter } from "next/navigation";
import { createClient } from "@v1/supabase/client";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";

export function SignOut() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? "en";

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace(`/${locale}/login`);
  };

  return (
    <Button onClick={handleSignOut} variant="outline" className="font-mono gap-2 flex items-center">
      <Icons.SignOut className="size-4" />
      <span>Sign out</span>
    </Button>
  );
}
