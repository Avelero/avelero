"use client";

import { createClient } from "@v1/supabase/client";
import { Button } from "@v1/ui/button";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function GoogleSignin() {
  const [isLoading, setIsLoading] = useState(false);
  const searchParams = useSearchParams();

  // Preserve intended post-auth destination (e.g. ?return_to=/dashboard)
  const returnTo = searchParams.get("return_to");

  const handleSignin = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const redirectTo = new URL("/api/auth/callback", window.location.origin);
      redirectTo.searchParams.append("provider", "google");
      if (returnTo) {
        redirectTo.searchParams.append("return_to", returnTo);
      }

      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectTo.toString(),
          queryParams: { prompt: "select_account" },
        },
      });
    } catch (error) {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleSignin}
      variant="outline"
      className="w-full font-sans"
      disabled={isLoading}
    >
      {isLoading ? "Connecting..." : "Continue with Google"}
    </Button>
  );
}
