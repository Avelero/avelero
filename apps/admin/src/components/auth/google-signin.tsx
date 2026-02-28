"use client";

import { createClient } from "@v1/supabase/client";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleIdentityApi = {
  initialize: (input: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    nonce?: string;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type: "standard";
      theme: "outline";
      size: "large";
      text: "continue_with";
      shape: "rectangular";
      width: number;
      logo_alignment: "left" | "center";
    },
  ) => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleIdentityApi;
      };
    };
  }
}

const GOOGLE_SCRIPT_ID = "google-identity-services-script";
const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const GENERIC_ERROR = "Unable to sign in. Please contact your administrator.";

type Props = {
  initialErrorMessage?: string | null;
};

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.2 0 6.1 1.1 8.3 3.1l6.2-6.2C34.6 2.8 29.7.5 24 .5 14.6.5 6.5 5.9 2.5 13.8l7.3 5.7C11.8 13.4 17.4 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.6c0-1.5-.1-2.9-.4-4.3H24v8.1h12.7c-.6 3-2.3 5.5-4.8 7.1l7.4 5.7c4.3-4 6.8-9.8 6.8-16.6z"
      />
      <path
        fill="#FBBC05"
        d="M9.8 28.5c-.5-1.5-.8-3-.8-4.6s.3-3.2.8-4.6l-7.3-5.7C.9 16.9 0 20.4 0 23.9s.9 7 2.5 10.2l7.3-5.6z"
      />
      <path
        fill="#34A853"
        d="M24 47.5c5.7 0 10.5-1.9 14-5.1l-7.4-5.7c-2 1.4-4.6 2.3-7.6 2.3-6.6 0-12.2-3.9-14.2-9.7l-7.3 5.6c4 7.9 12.1 12.6 22.5 12.6z"
      />
    </svg>
  );
}

async function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) {
    return;
  }

  const existingScript = document.getElementById(
    GOOGLE_SCRIPT_ID,
  ) as HTMLScriptElement | null;

  if (existingScript) {
    await new Promise<void>((resolve, reject) => {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Failed to load Google script")),
        { once: true },
      );
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google script"));
    document.head.appendChild(script);
  });
}

export function GoogleSignin({ initialErrorMessage = null }: Props) {
  const supabase = useMemo(() => createClient(), []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialErrorMessage,
  );

  const hiddenGoogleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const handleGoogleResponse = useCallback(
    async (response: GoogleCredentialResponse) => {
      const token = response.credential;
      if (!token) {
        setErrorMessage(GENERIC_ERROR);
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token,
        });

        if (error) {
          setErrorMessage(GENERIC_ERROR);
          setIsSubmitting(false);
          return;
        }

        const redirectTo = new URL("/api/auth/callback", window.location.origin);
        window.location.assign(redirectTo.toString());
      } catch {
        setErrorMessage(GENERIC_ERROR);
        setIsSubmitting(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    let isMounted = true;

    if (!googleClientId) {
      setErrorMessage("Google sign-in is unavailable.");
      return;
    }

    const initGoogleButton = async () => {
      try {
        await loadGoogleScript();
        if (!isMounted) return;

        const googleId = window.google?.accounts?.id;
        const buttonContainer = hiddenGoogleButtonRef.current;

        if (!googleId || !buttonContainer) {
          setErrorMessage(GENERIC_ERROR);
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
        setErrorMessage(GENERIC_ERROR);
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

      {errorMessage ? (
        <p className="text-[12px] leading-[16px] text-destructive px-0.5">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
