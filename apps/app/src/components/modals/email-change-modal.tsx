// apps/app/src/components/modals/email-change-modal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient as createSupabaseClient } from "@v1/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@v1/ui/dialog";
import { Button } from "@v1/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@v1/ui/input-otp";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentEmail: string;
  newEmail: string;
  onSuccess?: () => void;
}

type Step = "otp_old" | "otp_new" | "success";

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
    const i = setInterval(() => setCooldownOld((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(i);
  }, [cooldownOld]);

  useEffect(() => {
    if (cooldownNew <= 0) return;
    const i = setInterval(() => setCooldownNew((s) => (s > 0 ? s - 1 : 0)), 1000);
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
    if (error) setError(error.message || "Failed to send code. Try again.");
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
      setError(u.error.message || "Failed to start email change.");
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
    if (u.error) setError(u.error.message || "Failed to resend code.");
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

    await supabase.auth.getSession();
    // Best-effort: mirror email to public.users and refresh cache
    try {
      await updateUserMutation.mutateAsync({ email: newEmail });
      await queryClient.invalidateQueries({ queryKey: trpc.user.me.queryKey() });
    } catch {
      // ignore errors to avoid blocking success UX
    }
    setBusy(false);
    setStep("success");
    onSuccess?.();
  }

  const title =
    step === "otp_old"
      ? "Confirm your current email"
      : step === "otp_new"
      ? "Confirm your new email"
      : "Email updated";

  const description =
    step === "otp_old"
      ? `Enter the 6-digit code sent to ${currentEmail}`
      : step === "otp_new"
      ? `Enter the 6-digit code sent to ${newEmail}`
      : `You can continue using the app. We updated your account to ${newEmail}.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {step === "otp_old" && (
          <div className="space-y-4">
            <InputOTP
              maxLength={6}
              value={codeOld}
              onChange={setCodeOld}
              render={({ slots }) => (
                <InputOTPGroup>
                  {slots.map((slot, index) => (
                    <InputOTPSlot key={index} {...slot} />
                  ))}
                </InputOTPGroup>
              )}
            />
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            <div className="flex items-center gap-3">
              <Button
                variant="default"
                disabled={isBusy || codeOld.length !== 6}
                onClick={verifyOtpOldThenRequestChange}
              >
                {isBusy ? "Verifying..." : "Continue"}
              </Button>
              <Button variant="ghost" disabled={isBusy || cooldownOld > 0} onClick={sendOtpOld}>
                {cooldownOld > 0 ? `Resend in ${cooldownOld}s` : "Resend code"}
              </Button>
            </div>
          </div>
        )}

        {step === "otp_new" && (
          <div className="space-y-4">
            <InputOTP
              maxLength={6}
              value={codeNew}
              onChange={setCodeNew}
              render={({ slots }) => (
                <InputOTPGroup>
                  {slots.map((slot, index) => (
                    <InputOTPSlot key={index} {...slot} />
                  ))}
                </InputOTPGroup>
              )}
            />
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            <div className="flex items-center gap-3">
              <Button variant="default" disabled={isBusy || codeNew.length !== 6} onClick={verifyOtpNew}>
                {isBusy ? "Verifying..." : "Update email"}
              </Button>
              <Button variant="ghost" disabled={isBusy || cooldownNew > 0} onClick={resendOtpNew}>
                {cooldownNew > 0 ? `Resend in ${cooldownNew}s` : "Resend code"}
              </Button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="space-y-4">
            <p className="text-sm text-secondary">Email updated successfully. You may close this window.</p>
            <div className="flex justify-end">
              <Button variant="default" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}