"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@v1/supabase/client";
import { DropdownMenuItem } from "@v1/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function SignOut() {
  const [isLoading, setLoading] = useState(false);
  const supabase = createClient();
  const queryClient = useQueryClient();
  const router = useRouter();

  // Prefetch login route for post-signout navigation
  useEffect(() => {
    router.prefetch("/login");
  }, [router]);

  const handleSignOut = async () => {
    setLoading(true);

    // Clear all cached queries to ensure fresh slate
    queryClient.clear();

    await supabase.auth.signOut({
      scope: "local",
    });

    router.push("/login");
  };

  return (
    <DropdownMenuItem onClick={handleSignOut}>
      {isLoading ? "Loading..." : "Sign out"}
    </DropdownMenuItem>
  );
}
