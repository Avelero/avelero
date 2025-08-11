"use client";

import { createClient } from "@v1/supabase/client";
import { Button } from "@v1/ui/button";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function GoogleSignin() {
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();
  const searchParams = useSearchParams();

  // Preserve intended post-auth destination (e.g. ?return_to=/dashboard)
  const returnTo = searchParams.get("return_to");

  const handleSignin = async () => {
    setIsLoading(true);
    try {
      const redirectTo = new URL("/api/auth/callback", window.location.origin);

      // Inform the callback of the provider we used (handy for analytics)
      redirectTo.searchParams.append("provider", "google");

      if (returnTo) {
        redirectTo.searchParams.append("return_to", returnTo);
      }

      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectTo.toString(),
          // Force the Google account picker in case the user is logged in with multiple accounts
          queryParams: { prompt: "select_account" },
        },
      });
    } catch (error) {
      console.error("Google signin error:", error);
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleSignin}
      variant="outline"
      className="w-full font-mono"
      disabled={isLoading}
    >
      {isLoading ? "Connecting..." : "Continue with Google"}
    </Button>
  );
}
