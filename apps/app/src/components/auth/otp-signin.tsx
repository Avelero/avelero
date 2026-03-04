"use client";

import { startOtpAction } from "@/actions/auth/start-otp-action";
import { verifyOtpAction } from "@/actions/auth/verify-otp-action";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Input } from "@v1/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@v1/ui/input-otp";
import { useAction } from "next-safe-action/hooks";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = {
  className?: string;
};

const INVITE_REQUIRED_MESSAGE =
  "This email address needs an active invitation before sign-in is allowed.";
const BRAND_ACCESS_REMOVED_MESSAGE =
  "Your brand access has been removed, please contact your administrator.";
const RATE_LIMITED_MESSAGE =
  "Too many attempts. Please wait a moment and try again.";
const GENERIC_MESSAGE = "Unable to sign in. Please try again.";

function getAuthErrorMessage(errorCode: string | null | undefined): string {
  if (errorCode === "invite-required") return INVITE_REQUIRED_MESSAGE;
  if (errorCode === "brand-access-removed") return BRAND_ACCESS_REMOVED_MESSAGE;
  if (errorCode === "auth-rate-limited") return RATE_LIMITED_MESSAGE;
  return GENERIC_MESSAGE;
}

function getQueryErrorMessage(
  errorCode: string | null,
  provider: string | null,
): string | null {
  if (provider && provider !== "otp") return null;
  if (!errorCode) return null;

  if (errorCode === "invite-required") {
    return INVITE_REQUIRED_MESSAGE;
  }
  if (errorCode === "brand-access-removed") {
    return BRAND_ACCESS_REMOVED_MESSAGE;
  }
  if (errorCode === "auth-rate-limited") {
    return RATE_LIMITED_MESSAGE;
  }

  if (errorCode === "auth-unavailable") {
    return GENERIC_MESSAGE;
  }

  return null;
}

export function OTPSignIn({ className }: Props) {
  const startOtp = useAction(startOtpAction);
  const verifyOtp = useAction(verifyOtpAction);
  const [isLoading, setLoading] = useState(false);
  const [isSent, setSent] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [email, setEmail] = useState<string>();
  const [otpValue, setOtpValue] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [showQueryError, setShowQueryError] = useState(true);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const startOtpResetRef = useRef(startOtp.reset);
  const verifyOtpResetRef = useRef(verifyOtp.reset);
  const queryErrorMessage = getQueryErrorMessage(
    searchParams.get("error"),
    searchParams.get("provider"),
  );
  const visibleError = sendError ?? (showQueryError ? queryErrorMessage : null);

  startOtpResetRef.current = startOtp.reset;
  verifyOtpResetRef.current = verifyOtp.reset;

  // Reset form state when the route changes.
  useEffect(() => {
    setSent(false);
    setOtpValue("");
    setEmailInput("");
    setEmail(undefined);
    setSendError(null);
    setShowQueryError(true);
    setLoading(false);
    startOtpResetRef.current();
    verifyOtpResetRef.current();
  }, [pathname]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Clear previous errors
    setSendError(null);

    // Validate email format
    const emailValue = emailInput.trim();
    if (!emailValue) {
      setSendError("Please enter your email");
      return;
    }

    // Check if it's a valid email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailValue)) {
      setSendError("Please enter a valid email");
      return;
    }

    const normalizedEmail = emailValue.toLowerCase();
    setLoading(true);
    setEmail(normalizedEmail);

    try {
      const result = await startOtp.executeAsync({
        email: normalizedEmail,
      });

      if (result?.serverError) {
        setSendError(GENERIC_MESSAGE);
        return;
      }

      const actionData = result?.data;
      if (!actionData?.ok) {
        const errorCode =
          actionData && "errorCode" in actionData
            ? actionData.errorCode
            : "auth-unavailable";
        setSendError(getAuthErrorMessage(errorCode));
        return;
      }

      setSent(true);
    } catch {
      setSendError(GENERIC_MESSAGE);
    } finally {
      setLoading(false);
    }
  }

  async function onComplete(token: string) {
    if (!email) return;

    // Normalize return_to: trim whitespace, remove leading slashes, then add single "/"
    const returnTo = searchParams.get("return_to");
    let redirectPath = "/";
    if (returnTo) {
      const normalized = returnTo.trim().replace(/^\/+/, "");
      // Only use it if it's non-empty after normalization
      redirectPath = normalized ? `/${normalized}` : "/";
    }

    const result = await verifyOtp.executeAsync({
      token,
      email,
      redirectTo: redirectPath,
    });

    // If there's an error, clear the OTP so user can try again
    if (result?.serverError) {
      setOtpValue("");
    }
  }

  const handleCancel = () => {
    setSent(false);
    setOtpValue("");
    setSendError(null);
    verifyOtp.reset();
  };

  if (isSent) {
    return (
      <div className={cn("flex flex-col space-y-4", className)}>
        <div className="space-y-1">
          <InputOTP
            maxLength={6}
            autoFocus
            value={otpValue}
            onChange={(value) => {
              setOtpValue(value);
              // Clear error when user starts typing
              if (verifyOtp.result.serverError) {
                verifyOtp.reset();
              }
            }}
            onComplete={onComplete}
            disabled={verifyOtp.status === "executing"}
            className="!mt-0 !mb-0 !m-0"
            render={({ slots }) => (
              <InputOTPGroup className="w-full gap-2 justify-start">
                {slots.map((slot, index) => (
                  <InputOTPSlot
                    key={index.toString()}
                    {...slot}
                    className="flex-1 aspect-square"
                  />
                ))}
              </InputOTPGroup>
            )}
          />
          {verifyOtp.result.serverError && (
            <p className="text-[12px] leading-[16px] text-destructive px-0.5">
              {verifyOtp.result.serverError}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={verifyOtp.status === "executing"}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onComplete(otpValue)}
            disabled={verifyOtp.status === "executing"}
            className="flex-1"
          >
            {verifyOtp.status === "executing" ? "Verifying..." : "Submit"}
          </Button>
        </div>

        <div className="flex items-center justify-center gap-1 type-small text-secondary">
          <span>Didn't receive an email?</span>
          <button
            onClick={() => {
              setSent(false);
              setOtpValue("");
              setSendError(null);
              verifyOtp.reset();
            }}
            type="button"
            className="text-primary underline font-medium hover:no-underline"
          >
            Resend code
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className={cn("flex flex-col space-y-4", className)}>
        <div className="space-y-1">
          <Input
            id="email"
            type="text"
            placeholder="Enter email address"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={emailInput}
            onChange={(e) => {
              setEmailInput(e.target.value);
              setSendError(null);
              setShowQueryError(false);
            }}
            className={cn(
              visibleError &&
                "focus-visible:ring-1 focus-visible:ring-destructive focus-visible:outline-none",
            )}
            aria-invalid={!!visibleError}
          />
          {visibleError && (
            <p className="text-[12px] leading-[16px] text-destructive px-0.5">
              {visibleError}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full h-10" disabled={isLoading}>
          {isLoading ? "Sending..." : "Continue"}
        </Button>
      </div>
    </form>
  );
}
