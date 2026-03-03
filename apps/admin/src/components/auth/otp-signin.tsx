"use client";

import { startOtpAction } from "@/actions/auth/start-otp-action";
import { verifyOtpAction } from "@/actions/auth/verify-otp-action";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Input } from "@v1/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@v1/ui/input-otp";
import { useAction } from "next-safe-action/hooks";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const GENERIC_ERROR = "Unable to sign in. Please contact your administrator.";
const RATE_LIMITED_ERROR = "Too many attempts. Please wait a moment and try again.";
const DEBUG_SCOPE = "[TEMP_DEBUG][admin-auth][otp]";

type Props = {
  className?: string;
};

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`;
}

function debugLog(event: string, payload: Record<string, unknown> = {}) {
  console.info(`${DEBUG_SCOPE} ${event}`, payload);
}

export function OTPSignIn({ className }: Props) {
  const startOtp = useAction(startOtpAction);
  const verifyOtp = useAction(verifyOtpAction);
  const pathname = usePathname();
  const startOtpResetRef = useRef(startOtp.reset);
  const verifyOtpResetRef = useRef(verifyOtp.reset);

  const [isSent, setSent] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [email, setEmail] = useState<string>();
  const [otpValue, setOtpValue] = useState("");
  const [isLoading, setLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  startOtpResetRef.current = startOtp.reset;
  verifyOtpResetRef.current = verifyOtp.reset;

  useEffect(() => {
    setSent(false);
    setOtpValue("");
    setEmailInput("");
    setEmail(undefined);
    setSendError(null);
    setLoading(false);
    startOtpResetRef.current();
    verifyOtpResetRef.current();
  }, [pathname]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setSendError(null);

    const normalized = emailInput.trim().toLowerCase();
    if (!normalized) {
      setSendError("Please enter your email");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalized)) {
      setSendError("Please enter a valid email");
      return;
    }

    setLoading(true);
    setEmail(normalized);

    try {
      debugLog("startOtp.execute", {
        email: maskEmail(normalized),
      });

      const result = await startOtp.executeAsync({
        email: normalized,
      });

      if (result?.serverError) {
        debugLog("startOtp.server-error", {
          email: maskEmail(normalized),
          serverError: result.serverError,
        });
        setSendError(GENERIC_ERROR);
        return;
      }

      const actionData = result?.data;
      if (!actionData?.ok) {
        const errorCode =
          actionData && "errorCode" in actionData
            ? actionData.errorCode
            : "auth-unavailable";
        const debugData =
          actionData && "debug" in actionData ? actionData.debug : undefined;

        debugLog("startOtp.denied", {
          email: maskEmail(normalized),
          errorCode,
          debug: debugData ?? null,
        });

        if (errorCode === "auth-rate-limited") {
          setSendError(RATE_LIMITED_ERROR);
          return;
        }
        setSendError(GENERIC_ERROR);
        return;
      }

      debugLog("startOtp.success", {
        email: maskEmail(normalized),
      });
      setSent(true);
    } catch (error) {
      debugLog("startOtp.exception", {
        email: maskEmail(normalized),
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
              }
            : String(error),
      });
      setSendError(GENERIC_ERROR);
    } finally {
      setLoading(false);
    }
  }

  async function onComplete(token: string) {
    if (!email || token.length !== 6) return;

    const result = await verifyOtp.executeAsync({
      token,
      email,
    });

    if (result?.serverError) {
      debugLog("verifyOtp.server-error", {
        email: maskEmail(email),
        serverError: result.serverError,
      });
      setOtpValue("");
    }
  }

  const handleCancel = () => {
    setSent(false);
    setOtpValue("");
    setSendError(null);
    verifyOtp.reset();
  };

  const isOtpComplete = otpValue.length === 6;

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
            onClick={() => {
              if (!isOtpComplete) return;
              onComplete(otpValue);
            }}
            disabled={verifyOtp.status === "executing" || !isOtpComplete}
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
            onChange={(event) => {
              setEmailInput(event.target.value);
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
