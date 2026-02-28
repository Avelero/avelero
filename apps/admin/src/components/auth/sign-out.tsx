"use client";

import { createClient } from "@v1/supabase/client";
import { DropdownMenuItem } from "@v1/ui/dropdown-menu";
import { useState } from "react";

export function SignOut() {
  const [isLoading, setLoading] = useState(false);
  const supabase = createClient();

  const handleSignOut = async () => {
    setLoading(true);
    await supabase.auth.signOut({ scope: "global" });
    window.location.href = "/login";
  };

  return (
    <DropdownMenuItem onClick={handleSignOut}>
      {isLoading ? "Loading..." : "Sign out"}
    </DropdownMenuItem>
  );
}
