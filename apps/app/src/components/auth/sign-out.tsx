"use client";

import { createClient } from "@v1/supabase/client";
import { DropdownMenuItem } from "@v1/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export function SignOut() {
  const [isLoading, setLoading] = useState(false);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const handleSignOut = async () => {
    setLoading(true);

    // Clear all cached queries to ensure fresh slate
    queryClient.clear();

    // Clear any browser-stored form data
    if (typeof window !== "undefined") {
      sessionStorage.clear();
      localStorage.removeItem("supabase.auth.token");
    }

    await supabase.auth.signOut({
      scope: "global",
    });

    // Use hard navigation to bypass bfcache and reset all React state
    window.location.href = "/login";
  };

  return (
    <DropdownMenuItem onClick={handleSignOut}>
      {isLoading ? "Loading..." : "Sign out"}
    </DropdownMenuItem>
  );
}
