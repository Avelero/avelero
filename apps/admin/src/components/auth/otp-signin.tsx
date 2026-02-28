"use client";

import { verifyOtpAction } from "@/actions/auth/verify-otp-action";
import { createClient } from "@v1/supabase/client";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Input } from "@v1/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@v1/ui/input-otp";
import { useAction } from "next-safe-action/hooks";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const GENERIC_ERROR = "Unable to sign in. Please contact your administrator.";

type Props = {
  className?: string;
};

export function OTPSignIn({ className }: Props) {
  const verifyOtp = useAction(verifyOtpAction);
  const supabase = createClient();
  const pathname = usePathname();

  const [isSent, setSent] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [email, setEmail] = useState<string>();
  const [otpValue, setOtpValue] = useState("");
  const [isLoading, setLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const mountCountRef = useRef(0);

  useEffect(() => {
    mountCountRef.current += 1;
    setSent(false);
    setOtpValue("");
    setEmailInput("");
    setEmail(undefined);
    setSendError(null);
    setLoading(false);
    verifyOtp.reset();
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
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: normalized,
        options: {
          shouldCreateUser: false,
        },
      });

      if (otpError) {
        setSendError(GENERIC_ERROR);
        return;
      }

      setSent(true);
    } catch {
      setSendError(GENERIC_ERROR);
    } finally {
      setLoading(false);
    }
  }

  async function onComplete(token: string) {
    if (!email) return;

    const result = await verifyOtp.executeAsync({
      token,
      email,
    });

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
