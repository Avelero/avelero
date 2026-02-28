"use client";

import { useSearchParams } from "next/navigation";

function getLoginFeedback(params: URLSearchParams): string | null {
  const invite = params.get("invite");
  if (invite === "invalid") {
    return "This invite link is invalid or expired. Ask your workspace owner for a new invitation.";
  }

  const error = params.get("error");
  if (!error) return null;

  if (error === "invite-required") {
    return "This email address needs an active invitation before account creation is allowed.";
  }
  if (error === "auth-code-error") {
    return "Google sign-in could not be completed. Please try again or use email verification.";
  }
  if (error === "auth-session-missing") {
    return "Your session was not found. Please sign in again.";
  }
  if (error === "profile-creation-failed" || error === "profile-fetch-failed") {
    return "Your account profile could not be loaded. Please retry and contact support if this persists.";
  }

  return "Authentication failed. Please try again.";
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
