"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@v1/supabase/client";
import { Button } from "@v1/ui/button";
import type { ComponentProps } from "react";
import { useState } from "react";

interface SignOutButtonProps {
  className?: string;
  variant?: ComponentProps<typeof Button>["variant"];
}

export function SignOutButton({
  className,
  variant = "outline",
}: SignOutButtonProps) {
  const [isLoading, setLoading] = useState(false);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const handleSignOut = async () => {
    setLoading(true);

    queryClient.clear();

    if (typeof window !== "undefined") {
      sessionStorage.clear();
      localStorage.removeItem("supabase.auth.token");
    }

    await supabase.auth.signOut({
      scope: "global",
    });

    window.location.href = "/login";
  };

  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      disabled={isLoading}
      onClick={handleSignOut}
    >
      {isLoading ? "Signing out..." : "Sign out and switch account"}
    </Button>
  );
}
