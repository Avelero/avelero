"use client";

import { createClient } from "@v1/supabase/client";
import { Button } from "@v1/ui/button";
import { toast } from "@v1/ui/sonner";
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
      redirectTo.searchParams.append("provider", "google");
      if (returnTo) {
        redirectTo.searchParams.append("return_to", returnTo);
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectTo.toString(),
          queryParams: { prompt: "select_account" },
        },
      });

      if (error) {
        toast.error(
          error.message || "Failed to connect with Google. Please try again.",
        );
        setIsLoading(false);
      }
      // Note: If successful, user will be redirected to Google, so no need to reset loading state
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unable to connect with Google. Please check your connection and try again.";
      toast.error(errorMessage);
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
