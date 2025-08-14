### OTP Specifications (Email One-Time Passcode)

This document describes a robust, OTP-only email authentication flow. It excludes MFA and any "preferred sign-in provider" cookies. It includes a micro-repository organization, flow explanation, robustness checklist, and full generalized reference implementations you can adapt.

## Micro-repository organization (OTP-only)

- app (or apps/dashboard)
  - `src/app/(auth)/login/page.tsx`
    - Server component rendering the login page and `<OTPSignIn />`.
  - `src/components/otp-sign-in.tsx`
    - Client component: email entry, OTP entry, request/verify logic.
  - `src/actions/verify-otp-action.ts`
    - Server action: validates input, verifies OTP with Supabase, redirects.
  - `src/actions/safe-action.ts`
    - Safe Action client configuration used by `verify-otp-action`.
- ui package (or local components)
  - `src/components/input-otp.tsx`
    - `InputOTP` primitives used to render and capture the 6-digit OTP.
- Supabase client wrappers
  - `src/supabase/client.ts`
    - Browser `createClient` used by `otp-sign-in.tsx` to call `signInWithOtp`.
  - `src/supabase/server.ts`
    - Server `createClient` used by `verify-otp-action.ts` to call `verifyOtp`.

## How the OTP flow works

- Request OTP (client)
  - User submits their email in `otp-sign-in.tsx`.
  - Browser Supabase client calls `supabase.auth.signInWithOtp({ email })`.
  - On success, the UI swaps to the OTP input view.

- Enter OTP and submit (client)
  - After user enters the 6-digit code, `otp-sign-in.tsx` invokes a server action `verifyOtpAction` with `{ token, email, redirectTo }`.

- Verify OTP and redirect (server)
  - `verify-otp-action.ts` validates inputs, calls `supabase.auth.verifyOtp({ email, token, type: 'email' })` on the server Supabase client, then `redirect(redirectTo)`.

## Robustness checklist (OTP-only)

- Client send errors: Handle `{ error }` from `signInWithOtp`; show inline error and don't switch to OTP UI if it fails.
- Client verify errors: Await the server action; show inline errors and allow retry on failure.
- Prevent double submits: Disable buttons/inputs and ignore extra events while in-flight.
- Resend flow: Add a resend button with cooldown (e.g., 30–60s) and proper disabled state.
- Redirect safety: Accept only relative paths; normalize to `/` when invalid.
- Rate limiting: Add server-side throttling and optionally CAPTCHA after repeated failures.
- UX resilience: Persist the email during OTP phase; show clear messages for expired/invalid codes.
- Config alignment: Ensure `type: 'email'` for passwordless OTP and the UI expects 6 digits.

---

## Reference implementation (generalized)

Adjust paths and module boundaries to match your app (monorepo or single app). These examples assume Next.js App Router and TypeScript.

### 1) `src/app/(auth)/login/page.tsx`

```tsx
// Server component
import { OTPSignIn } from "@/components/otp-sign-in";

export default async function Page() {
  return (
    <main className="mx-auto max-w-md py-12">
      <h1 className="text-2xl font-semibold mb-6">Sign in</h1>
      <OTPSignIn />
    </main>
  );
}
```

### 2) `src/components/otp-sign-in.tsx`

```tsx
"use client";

import { useState, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createBrowserSupabase } from "@/supabase/client";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/input-otp";
import { useAction } from "next-safe-action/hooks";
import { verifyOtpAction } from "@/actions/verify-otp-action";

const emailSchema = z.object({
  email: z.string().email(),
});

type EmailForm = z.infer<typeof emailSchema>;

export function OTPSignIn() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const verifyOtp = useAction(verifyOtpAction);

  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const { register, handleSubmit, formState } = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const startCooldown = useCallback((seconds: number) => {
    setResendCooldown(seconds);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const onSubmit = async ({ email }: EmailForm) => {
    if (isSending) return;
    setError(null);
    setIsSending(true);

    const { error } = await supabase.auth.signInWithOtp({ email });
    setIsSending(false);

    if (error) {
      setError(error.message || "Failed to send OTP. Please try again.");
      return;
    }

    setEmail(email);
    setIsSent(true);
    startCooldown(45);
  };

  const onComplete = async (token: string) => {
    if (isVerifying || !email) return;
    setError(null);
    setIsVerifying(true);

    const redirectTo = sanitizeRedirectPath(
      typeof window !== "undefined" ? window.location.pathname : "/"
    );

    const result = await verifyOtp.execute({ token, email, redirectTo });
    setIsVerifying(false);

    if (result?.serverError) {
      setError(result.serverError);
      return;
    }

    // On success, the server action will redirect. If not, user stays here.
  };

  const resend = async () => {
    if (!email || resendCooldown > 0 || isSending) return;
    setError(null);
    setIsSending(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setIsSending(false);
    if (error) {
      setError(error.message || "Failed to resend OTP. Please try again.");
      return;
    }
    startCooldown(45);
  };

  return (
    <div className="space-y-4">
      {!isSent ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              spellCheck={false}
              className="w-full rounded border px-3 py-2"
              disabled={isSending}
              {...register("email")}
            />
            {formState.errors.email && (
              <p className="text-sm text-red-600">{formState.errors.email.message}</p>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={isSending}
            className="inline-flex items-center justify-center rounded bg-black px-4 py-2 text-white disabled:opacity-60"
          >
            {isSending ? "Sending..." : "Send code"}
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Enter the 6-digit code sent to <span className="font-medium">{email}</span>
          </p>
          <InputOTP
            maxLength={6}
            disabled={isVerifying}
            onComplete={onComplete}
            render={({ slots }) => (
              <InputOTPGroup>
                {slots.map((slot, idx) => (
                  <InputOTPSlot key={idx} {...slot} className="h-12 w-12" />
                ))}
              </InputOTPGroup>
            )}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resend}
              disabled={isSending || resendCooldown > 0}
              className="text-sm underline disabled:opacity-60"
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
            </button>
            <button
              type="button"
              onClick={() => setIsSent(false)}
              className="text-sm text-gray-600"
            >
              Use a different email
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function sanitizeRedirectPath(path: string | undefined): string {
  if (!path) return "/";
  try {
    // Only allow relative paths
    const url = new URL(path, "http://localhost");
    return url.pathname || "/";
  } catch {
    return "/";
  }
}
```

### 3) `src/actions/verify-otp-action.ts`

```ts
"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/supabase/server";
import { actionClient } from "@/actions/safe-action";

const schema = z.object({
  token: z.string().min(1),
  email: z.string().email(),
  redirectTo: z.string().default("/"),
});

function sanitizeRedirectPath(path: string | undefined): string {
  if (!path) return "/";
  try {
    const url = new URL(path, "http://localhost");
    return url.pathname || "/";
  } catch {
    return "/";
  }
}

export const verifyOtpAction = actionClient
  .schema(schema)
  .action(async ({ parsedInput }) => {
    const { email, token, redirectTo } = parsedInput;
    const supabase = createServerSupabase();

    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (error) {
      throw new Error(error.message || "OTP verification failed");
    }

    redirect(sanitizeRedirectPath(redirectTo));
  });
```

### 4) `src/actions/safe-action.ts`

```ts
import { createSafeActionClient } from "next-safe-action";

export const actionClient = createSafeActionClient({
  handleServerError(err) {
    if (err instanceof Error) {
      // Ensure a string is returned to be surfaced to the client
      return err.message;
    }
    return "An unexpected error occurred";
  },
});
```

### 5) `src/components/input-otp.tsx`

```tsx
import { useEffect, useMemo, useRef, useState } from "react";

type SlotProps = {
  value: string;
  onChange: (val: string) => void;
  onBackspace: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
  className?: string;
};

export function InputOTPSlot({ value, onChange, onBackspace, inputRef, className }: SlotProps) {
  return (
    <input
      ref={inputRef}
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={1}
      value={value}
      onChange={(e) => {
        const next = e.target.value.replace(/\D/g, "");
        onChange(next.slice(-1));
      }}
      onKeyDown={(e) => {
        if (e.key === "Backspace" && !value) onBackspace();
      }}
      className={className || "h-10 w-10 text-center rounded border"}
    />
  );
}

type GroupProps = {
  children: React.ReactNode;
  className?: string;
};

export function InputOTPGroup({ children, className }: GroupProps) {
  return <div className={className || "flex items-center gap-2"}>{children}</div>;
}

type RenderArgs = {
  slots: Array<{
    value: string;
    onChange: (val: string) => void;
    onBackspace: () => void;
    inputRef: React.RefObject<HTMLInputElement>;
  }>;
};

type InputOTPProps = {
  maxLength?: number; // default 6
  disabled?: boolean;
  onComplete: (code: string) => void;
  render: (args: RenderArgs) => React.ReactNode;
};

export function InputOTP({ maxLength = 6, disabled, onComplete, render }: InputOTPProps) {
  const [values, setValues] = useState<string[]>(() => Array(maxLength).fill(""));
  const inputRefs = useMemo(() => Array.from({ length: maxLength }, () => useRef<HTMLInputElement>(null)), [maxLength]);

  useEffect(() => {
    const code = values.join("");
    if (!disabled && code.length === maxLength && values.every((v) => v !== "")) {
      onComplete(code);
    }
  }, [values, maxLength, disabled, onComplete]);

  const slots = values.map((value, idx) => ({
    value,
    onChange: (val: string) => {
      setValues((prev) => {
        const next = [...prev];
        next[idx] = val;
        return next;
      });
      if (val && idx < maxLength - 1) inputRefs[idx + 1]?.current?.focus();
    },
    onBackspace: () => {
      if (idx > 0) inputRefs[idx - 1]?.current?.focus();
      setValues((prev) => {
        const next = [...prev];
        next[idx] = "";
        return next;
      });
    },
    inputRef: inputRefs[idx],
  }));

  return <>{render({ slots })}</>;
}
```

### 6) `src/supabase/client.ts`

```ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function createBrowserSupabase(): SupabaseClient {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  browserClient = createClient(url, anonKey);
  return browserClient;
}
```

### 7) `src/supabase/server.ts`

```ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export function createServerSupabase(): SupabaseClient {
  const cookieStore = cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });
}
```

---

## Minimal environment requirements

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be set.
- Supabase Auth passwordless email is enabled in your project.
- `next-safe-action` configured as shown for typed, safe server actions.

## Notes

- The server action redirect is authoritative. If you prefer client-side navigation, return a success value and navigate on the client, but server-side redirect is simpler and avoids hydration edge cases after auth.
- The `InputOTP` is deliberately minimal and framework-agnostic within React; replace with your UI kit’s OTP if desired.