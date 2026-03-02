"use client";

import { createClient } from "@v1/supabase/client";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import {
  GoogleLogo,
  loadGoogleScript,
  type GoogleCredentialResponse,
} from "@v1/ui/google-signin-shared";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const GENERIC_GOOGLE_ERROR =
  "Google sign-in could not be completed. Please try again or use email verification.";

function extractEmailFromIdToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length < 2 || !parts[1]) return null;

  try {
    const payload = parts[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const email = parsed.email;
    return typeof email === "string" && email.length > 0 ? email : null;
  } catch {
    return null;
  }
}

export function GoogleSignin() {
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hiddenGoogleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const returnTo = searchParams.get("return_to");
  const inviteTokenHash = searchParams.get("invite_token_hash");

  const handleGoogleResponse = useCallback(
    async (response: GoogleCredentialResponse) => {
      const token = response.credential;
      if (!token) {
        setErrorMessage(GENERIC_GOOGLE_ERROR);
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(true);
      setErrorMessage(null);

      const tokenEmail = extractEmailFromIdToken(token);
      if (!tokenEmail) {
        setErrorMessage(GENERIC_GOOGLE_ERROR);
        setIsSubmitting(false);
        return;
      }

      try {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token,
        });

        if (error) {
          setErrorMessage(GENERIC_GOOGLE_ERROR);
          setIsSubmitting(false);
          return;
        }

        const redirectTo = new URL("/api/auth/callback", window.location.origin);
        redirectTo.searchParams.append("provider", "google");
        if (returnTo) {
          redirectTo.searchParams.append("return_to", returnTo);
        }
        if (inviteTokenHash) {
          redirectTo.searchParams.append("invite_token_hash", inviteTokenHash);
        }

        // Single Google sign-in flow: popup id token sign-in, then one redirect to app callback.
        window.location.assign(redirectTo.toString());
      } catch {
        setErrorMessage(GENERIC_GOOGLE_ERROR);
        setIsSubmitting(false);
      }
    },
    [inviteTokenHash, returnTo, supabase],
  );

  useEffect(() => {
    let isMounted = true;

    if (!googleClientId) {
      setErrorMessage(
        "Google sign-in is unavailable. Please use email verification.",
      );
      return;
    }

    const initGoogleButton = async () => {
      try {
        await loadGoogleScript();
        if (!isMounted) return;

        const googleId = window.google?.accounts?.id;
        const buttonContainer = hiddenGoogleButtonRef.current;

        if (!googleId || !buttonContainer) {
          setErrorMessage(GENERIC_GOOGLE_ERROR);
          return;
        }

        googleId.initialize({
          client_id: googleClientId,
          callback: handleGoogleResponse,
        });

        buttonContainer.innerHTML = "";
        googleId.renderButton(buttonContainer, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          width: Math.max(buttonContainer.clientWidth, 200),
          logo_alignment: "left",
        });

        setIsReady(true);
      } catch {
        if (!isMounted) return;
        setErrorMessage(GENERIC_GOOGLE_ERROR);
      }
    };

    initGoogleButton();

    return () => {
      isMounted = false;
    };
  }, [googleClientId, handleGoogleResponse]);

  return (
    <div className="space-y-1">
      <div className="group relative">
        <Button
          type="button"
          variant="outline"
          className="w-full font-sans group-hover:bg-accent group-hover:text-accent-foreground"
          disabled={!isReady || isSubmitting}
        >
          {isSubmitting ? (
            "Connecting..."
          ) : (
            <span className="inline-flex items-center justify-center gap-2">
              <GoogleLogo />
              <span>Continue with Google</span>
            </span>
          )}
        </Button>

        <div
          ref={hiddenGoogleButtonRef}
          aria-hidden
          className={cn(
            "absolute inset-0 z-10 overflow-hidden opacity-0",
            !isReady || isSubmitting ? "pointer-events-none" : "pointer-events-auto",
          )}
        />
      </div>

      {errorMessage && (
        <p className="text-[12px] leading-[16px] text-destructive px-0.5">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
