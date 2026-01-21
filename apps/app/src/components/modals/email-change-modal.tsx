// apps/app/src/components/modals/email-change-modal.tsx
"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient as createSupabaseClient } from "@v1/supabase/client";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@v1/ui/input-otp";
import { toast } from "@v1/ui/sonner";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentEmail: string;
  newEmail: string;
  onSuccess?: () => void;
}

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

type Step = "otp_old" | "otp_new";

export function EmailChangeModal({
  open,
  onOpenChange,
  currentEmail,
  newEmail,
  onSuccess,
}: Props) {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const updateUserMutation = useMutation(trpc.user.update.mutationOptions());
  const slotKeys = useMemo(() => ["a", "b", "c", "d", "e", "f"], []);
  const [step, setStep] = useState<Step>("otp_old");
  const [codeOld, setCodeOld] = useState("");
  const [codeNew, setCodeNew] = useState("");
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sentOldOnce, setSentOldOnce] = useState(false);
  const [cooldownOld, setCooldownOld] = useState(0);
  const [cooldownNew, setCooldownNew] = useState(0);

  useEffect(() => {
    if (!open) {
      setStep("otp_old");
      setCodeOld("");
      setCodeNew("");
      setBusy(false);
      setError(null);
      setSentOldOnce(false);
      setCooldownOld(0);
      setCooldownNew(0);
    }
  }, [open]);

  useEffect(() => {
    if (open && step === "otp_old" && !sentOldOnce) void sendOtpOld();
  }, [open, step, sentOldOnce]);

  useEffect(() => {
    if (cooldownOld <= 0) return;
    const i = setInterval(
      () => setCooldownOld((s) => (s > 0 ? s - 1 : 0)),
      1000,
    );
    return () => clearInterval(i);
  }, [cooldownOld]);

  useEffect(() => {
    if (cooldownNew <= 0) return;
    const i = setInterval(
      () => setCooldownNew((s) => (s > 0 ? s - 1 : 0)),
      1000,
    );
    return () => clearInterval(i);
  }, [cooldownNew]);

  async function sendOtpOld() {
    if (!currentEmail) return;
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: currentEmail,
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    setSentOldOnce(true);
    if (error) setError(sanitizeErrorMessage(error.message));
    else setCooldownOld(45);
  }

  async function verifyOtpOldThenRequestChange() {
    if (codeOld.length !== 6) return;
    setError(null);
    setBusy(true);

    const v = await supabase.auth.verifyOtp({
      email: currentEmail,
      token: codeOld,
      type: "email",
    });
    if (v.error) {
      setBusy(false);
      setError(
        v.error.message.includes("expired")
          ? "Code expired. Resend and try again."
          : "Invalid code. Check and try again.",
      );
      return;
    }

    const u = await supabase.auth.updateUser({ email: newEmail });
    setBusy(false);
    if (u.error) {
      setError(sanitizeErrorMessage(u.error.message));
      return;
    }
    setStep("otp_new");
    setCooldownNew(45);
  }

  async function resendOtpNew() {
    if (!newEmail) return;
    setError(null);
    setBusy(true);
    const u = await supabase.auth.updateUser({ email: newEmail });
    setBusy(false);
    if (u.error) setError(sanitizeErrorMessage(u.error.message));
    else setCooldownNew(45);
  }

  async function verifyOtpNew() {
    if (codeNew.length !== 6) return;
    setError(null);
    setBusy(true);

    const v = await supabase.auth.verifyOtp({
      email: newEmail,
      token: codeNew,
      type: "email_change",
    });
    if (v.error) {
      setBusy(false);
      setError(
        v.error.message.includes("expired")
          ? "Code expired. Resend and try again."
          : "Invalid code. Check and try again.",
      );
      return;
    }

    // Refresh session to get updated auth state
    await supabase.auth.getSession();

    // Sync email to public.users table - this is critical for data consistency
    try {
      await updateUserMutation.mutateAsync({ email: newEmail });
      await queryClient.invalidateQueries({
        queryKey: trpc.user.get.queryKey(),
      });
      setBusy(false);
      toast.success("Email changed successfully");
      onSuccess?.();
      onOpenChange(false);
    } catch (syncError) {
      // Auth email is updated but DB sync failed - critical error
      setBusy(false);
      console.error("Failed to sync email to database:", syncError);
      toast.error(
        "Email updated in authentication but failed to sync. Please refresh the page or contact support.",
      );
      // Still close modal since auth is updated, but user is warned
      onOpenChange(false);
    }
  }

  const title =
    step === "otp_old" ? "Verify current email" : "Verify new email";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-foreground">{title}</DialogTitle>
        </DialogHeader>

        {step === "otp_old" && (
          <>
            {/* Main content */}
            <div className="px-6 py-4 min-h-[160px] flex flex-col justify-center space-y-4">
              <p className="type-p text-secondary">
                Enter the 6-digit code sent to{" "}
                <span className="font-medium text-foreground">
                  {currentEmail}
                </span>
              </p>
              <div className="flex flex-col items-center space-y-2">
                <InputOTP
                  maxLength={6}
                  value={codeOld}
                  onChange={setCodeOld}
                  className="!mt-0 !mb-0 !m-0"
                  render={({ slots }) => (
                    <InputOTPGroup className="gap-2">
                      {slots.map((slot, idx) => (
                        <InputOTPSlot
                          key={`old-${slotKeys[idx]}`}
                          char={slot.char}
                          hasFakeCaret={slot.hasFakeCaret}
                          isActive={slot.isActive}
                          placeholderChar={slot.placeholderChar}
                          className="h-10 w-14"
                        />
                      ))}
                    </InputOTPGroup>
                  )}
                />
                {error ? (
                  <p className="text-sm text-red-500 text-center">{error}</p>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={sendOtpOld}
                  disabled={isBusy || cooldownOld > 0}
                  className="text-secondary hover:bg-accent"
                >
                  {cooldownOld > 0
                    ? `Resend in ${cooldownOld}s`
                    : "Resend code"}
                </Button>
              </div>
            </div>

            {/* Footer */}
            <DialogFooter className="px-6 py-4 border-t border-border bg-background">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isBusy}
              >
                Cancel
              </Button>
              <Button
                onClick={verifyOtpOldThenRequestChange}
                disabled={isBusy || codeOld.length !== 6}
              >
                {isBusy && !sentOldOnce
                  ? "Sending..."
                  : codeOld.length === 6 && isBusy
                    ? "Verifying..."
                    : "Continue"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "otp_new" && (
          <>
            {/* Main content */}
            <div className="px-6 py-4 min-h-[160px] flex flex-col justify-center space-y-4">
              <p className="type-p text-secondary">
                Enter the 6-digit code sent to{" "}
                <span className="font-medium text-foreground">{newEmail}</span>
              </p>
              <div className="flex flex-col items-center space-y-2">
                <InputOTP
                  maxLength={6}
                  value={codeNew}
                  onChange={setCodeNew}
                  className="!mt-0 !mb-0 !m-0"
                  render={({ slots }) => (
                    <InputOTPGroup className="gap-2">
                      {slots.map((slot, idx) => (
                        <InputOTPSlot
                          key={`new-${slotKeys[idx]}`}
                          char={slot.char}
                          hasFakeCaret={slot.hasFakeCaret}
                          isActive={slot.isActive}
                          placeholderChar={slot.placeholderChar}
                          className="h-10 w-14"
                        />
                      ))}
                    </InputOTPGroup>
                  )}
                />
                {error ? (
                  <p className="text-sm text-red-500 text-center">{error}</p>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resendOtpNew}
                  disabled={isBusy || cooldownNew > 0}
                  className="text-secondary hover:bg-accent"
                >
                  {cooldownNew > 0
                    ? `Resend in ${cooldownNew}s`
                    : "Resend code"}
                </Button>
              </div>
            </div>

            {/* Footer */}
            <DialogFooter className="px-6 py-4 border-t border-border bg-background">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isBusy}
              >
                Cancel
              </Button>
              <Button
                onClick={verifyOtpNew}
                disabled={isBusy || codeNew.length !== 6}
              >
                {codeNew.length === 6 && isBusy
                  ? "Verifying..."
                  : "Update email"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
