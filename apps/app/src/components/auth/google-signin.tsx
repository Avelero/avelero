"use client";

import { createClient } from "@v1/supabase/client";
import { Button } from "@v1/ui/button";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * Detects if the current environment is a Vercel preview deployment.
 * Preview deployments have URLs like: https://project-git-branch-team.vercel.app
 * Production has a custom domain like: https://app.avelero.com
 */
function isPreviewEnvironment(): boolean {
  if (typeof window === "undefined") return false;

  const hostname = window.location.hostname;

  // Local development
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return false;
  }

  // Production domains
  if (
    hostname === "app.avelero.com" ||
    hostname === "avelero.com" ||
    hostname.endsWith(".avelero.com")
  ) {
    return false;
  }

  // Vercel preview deployments (*.vercel.app)
  if (hostname.endsWith(".vercel.app")) {
    return true;
  }

  // Any other domain treat as preview
  return true;
}

const PRODUCTION_APP_URL = "https://app.avelero.com";

export function GoogleSignin() {
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();
  const searchParams = useSearchParams();

  // Preserve intended post-auth destination (e.g. ?return_to=/dashboard)
  const returnTo = searchParams.get("return_to");

  const handleSignin = async () => {
    setIsLoading(true);
    try {
      const isPreview = isPreviewEnvironment();
      const currentUrl = window.location.href;


      // Determine the callback URL
      // - Production/Local: Use current origin
      // - Preview: Route through production (which has registered OAuth credentials)
      const callbackOrigin = isPreview
        ? PRODUCTION_APP_URL
        : window.location.origin;

      const redirectTo = new URL("/api/auth/callback", callbackOrigin);
      redirectTo.searchParams.append("provider", "google");

      // For preview, encode the return URL in the redirect URL itself
      // This is the only way to pass data cross-domain
      if (isPreview) {
        redirectTo.searchParams.append(
          "preview_return_url",
          encodeURIComponent(currentUrl),
        );
      } else if (returnTo) {
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

