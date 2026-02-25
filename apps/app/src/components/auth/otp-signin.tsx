"use client";

import { checkOtpAuthEligibilityAction } from "@/actions/auth/check-otp-auth-eligibility-action";
import { verifyOtpAction } from "@/actions/auth/verify-otp-action";
import { createClient } from "@v1/supabase/client";
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

/**
 * Converts technical Supabase error messages to user-friendly ones.
 * Prevents showing developer-facing errors to end users.
 */
function sanitizeErrorMessage(message: string | undefined): string {
  if (!message) return "Something went wrong. Please try again.";

  // List of patterns that indicate technical/developer errors
  const technicalErrorPatterns = [
    /failed to reach hook/i,
    /maximum time of \d+/i,
    /hook.*timeout/i,
    /internal server error/i,
    /unexpected.*error/i,
    /fetch failed/i,
    /network.*error/i,
  ];

  // Check if the message matches any technical error pattern
  for (const pattern of technicalErrorPatterns) {
    if (pattern.test(message)) {
      return "Something went wrong. Please try again.";
    }
  }

  // Return the original message if it's user-friendly
  return message;
}

export function OTPSignIn({ className }: Props) {
  const checkOtpAuthEligibility = useAction(checkOtpAuthEligibilityAction);
  const verifyOtp = useAction(verifyOtpAction);
  const [isLoading, setLoading] = useState(false);
  const [isSent, setSent] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [email, setEmail] = useState<string>();
  const [otpValue, setOtpValue] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const supabase = createClient();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Track mount count to force reset on navigation (handles bfcache)
  const mountCountRef = useRef(0);

  // Reset all form state on mount and when navigating back to this page
  useEffect(() => {
    mountCountRef.current += 1;
    setSent(false);
    setOtpValue("");
    setEmailInput("");
    setEmail(undefined);
    setSendError(null);
    setLoading(false);
    checkOtpAuthEligibility.reset();
    verifyOtp.reset();
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

    setLoading(true);
    setEmail(emailValue);

    const eligibilityResult = await checkOtpAuthEligibility.executeAsync({
      email: emailValue,
    });

    if (eligibilityResult?.serverError) {
      setSendError(sanitizeErrorMessage(eligibilityResult.serverError));
      setLoading(false);
      return;
    }

    const eligibility = eligibilityResult?.data?.status;
    const shouldCreateUser = eligibility === "pending_invite";

    if (eligibility === "not_found") {
      setSendError("This account doesn't exist. Ask brand owner for an invite.");
      setLoading(false);
      return;
    }

    if (!eligibility) {
      setSendError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: emailValue,
      options: {
        shouldCreateUser,
      },
    });

    if (error) {
      const loweredMessage = (error.message ?? "").toLowerCase();
      if (
        loweredMessage.includes("account_not_found") ||
        loweredMessage.includes("invite_required") ||
        loweredMessage.includes("user not found") ||
        loweredMessage.includes("signups not allowed") ||
        loweredMessage.includes("signup is disabled")
      ) {
        setSendError("This account doesn't exist. Ask brand owner for an invite.");
        setLoading(false);
        return;
      }

      setSendError(sanitizeErrorMessage(error.message));
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
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
    checkOtpAuthEligibility.reset();
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
            }}
            className={cn(
              sendError &&
                "focus-visible:ring-1 focus-visible:ring-destructive focus-visible:outline-none",
            )}
            aria-invalid={!!sendError}
          />
          {sendError && (
            <p className="text-[12px] leading-[16px] text-destructive px-0.5">
              {sendError}
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
