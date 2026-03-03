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

const GENERIC_ERROR = "Unable to sign in. Please contact your administrator.";
const AUTH_FAILED_ERROR = "Authentication failed. Please try again.";
const RATE_LIMITED_ERROR = "Too many attempts. Please wait a moment and try again.";
const DEBUG_SCOPE = "[TEMP_DEBUG][admin-auth][google]";

function debugLog(event: string, payload: Record<string, unknown> = {}) {
  console.info(`${DEBUG_SCOPE} ${event}`, payload);
}

function getQueryErrorMessage(errorCode: string | null): string | null {
  if (errorCode === "auth-denied") return GENERIC_ERROR;
  if (errorCode === "auth-rate-limited") return RATE_LIMITED_ERROR;
  if (errorCode === "auth-unavailable") return GENERIC_ERROR;
  if (errorCode === "auth-failed") return AUTH_FAILED_ERROR;
  return null;
}

export function GoogleSignin() {
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const queryErrorCode = searchParams.get("error");
  const queryErrorMessage = getQueryErrorMessage(queryErrorCode);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(queryErrorMessage);

  const hiddenGoogleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    setErrorMessage(queryErrorMessage);
  }, [queryErrorMessage]);

  useEffect(() => {
    if (!queryErrorCode) return;
    debugLog("query-error", {
      errorCode: queryErrorCode,
      mappedMessage: queryErrorMessage,
    });
  }, [queryErrorCode, queryErrorMessage]);

  const handleGoogleResponse = useCallback(
    async (response: GoogleCredentialResponse) => {
      const token = response.credential;
      if (!token) {
        debugLog("id-token-missing");
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
          debugLog("supabase-id-token-error", {
            message: error.message ?? null,
            code: error.code ?? null,
            status: error.status ?? null,
          });
          setErrorMessage(GENERIC_ERROR);
          setIsSubmitting(false);
          return;
        }

        const redirectTo = new URL("/api/auth/callback", window.location.origin);
        debugLog("redirecting-callback", {
          target: redirectTo.toString(),
        });
        window.location.assign(redirectTo.toString());
      } catch (error) {
        debugLog("google-signin-exception", {
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                }
              : String(error),
        });
        setErrorMessage(GENERIC_ERROR);
        setIsSubmitting(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    let isMounted = true;

    if (!googleClientId) {
      debugLog("google-client-id-missing");
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
          debugLog("google-script-ready-but-id-api-missing", {
            hasGoogleIdApi: !!googleId,
            hasButtonContainer: !!buttonContainer,
          });
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
      } catch (error) {
        if (!isMounted) return;
        debugLog("google-init-exception", {
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                }
              : String(error),
        });
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
