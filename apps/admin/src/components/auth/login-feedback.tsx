"use client";

import { useSearchParams } from "next/navigation";

function getLoginFeedback(params: URLSearchParams): string | null {
  const error = params.get("error");
  if (!error) return null;

  if (error === "auth-denied") {
    return "Unable to sign in. Please contact your administrator.";
  }

  if (error === "auth-failed") {
    return "Authentication failed. Please try again.";
  }

  return "Unable to sign in. Please try again.";
}

export function LoginFeedback() {
  const searchParams = useSearchParams();
  const message = getLoginFeedback(searchParams);
  if (!message) return null;

  return (
    <p className="rounded border border-destructive/20 bg-destructive/5 px-3 py-2 text-[12px] leading-[16px] text-destructive">
      {message}
    </p>
  );
}
