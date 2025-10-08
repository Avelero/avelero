"use client";

import { verifyOtpAction } from "@/actions/auth/verify-otp-action";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@v1/supabase/client";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Input } from "@v1/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@v1/ui/input-otp";
import { Label } from "@v1/ui/label";
import { useAction } from "next-safe-action/hooks";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
  email: z.string().email(),
});

type Props = {
  className?: string;
};

export function OTPSignIn({ className }: Props) {
  const verifyOtp = useAction(verifyOtpAction);
  const [isLoading, setLoading] = useState(false);
  const [isSent, setSent] = useState(false);
  const [email, setEmail] = useState<string>();
  const supabase = createClient();
  const searchParams = useSearchParams();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit({ email }: z.infer<typeof formSchema>) {
    setLoading(true);

    setEmail(email);

    await supabase.auth.signInWithOtp({ email });

    setSent(true);
    setLoading(false);
  }

  async function onComplete(token: string) {
    if (!email) return;

    verifyOtp.execute({
      token,
      email,
      redirectTo: `${window.location.origin}/${searchParams.get("return_to") || ""}`,
    });
  }

  const handleCancel = () => {
    setSent(false);
    form.reset();
  };

  if (isSent) {
    return (
      <div className={cn("flex flex-col space-y-4", className)}>
        <InputOTP
          maxLength={6}
          autoFocus
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
            onClick={() => onComplete("")}
            disabled={verifyOtp.status === "executing"}
            className="flex-1"
          >
            {verifyOtp.status === "executing" ? "Verifying..." : "Send"}
          </Button>
        </div>

        <div className="flex items-center justify-center gap-1 type-small text-secondary">
          <span>Didn't receive an email?</span>
          <button
            onClick={() => setSent(false)}
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
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className={cn("flex flex-col space-y-4", className)}>
        <div className="space-y-2">
          <Input
            id="email"
            type="email"
            placeholder="Enter email address"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            {...form.register("email")}
          />
        </div>

        <Button type="submit" className="w-full h-10" disabled={isLoading}>
          {isLoading ? "Sending..." : "Continue"}
        </Button>
      </div>
    </form>
  );
}
