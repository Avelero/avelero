"use client";

import { useSearchParams } from "next/navigation";

const INVITE_ERROR_MESSAGES = {
  invalid_token:
    "This invitation link is invalid. Please use the latest invite email.",
  expired_or_revoked:
    "This invitation link has expired or was revoked. Ask your brand owner for a new invite.",
  wrong_email:
    "This invitation was sent to a different email address. Sign in with the invited email.",
  accept_failed:
    "We couldn't accept your invitation right now. Please try again or request a new invite.",
} as const;

const AUTH_ERROR_MESSAGES = {
  "auth-code-error":
    "We couldn't complete sign-in with Google. Please try again.",
  "account_not_found":
    "This account doesn't exist. Ask brand owner for an invite.",
  "auth-session-missing": "Your session is missing. Please sign in again.",
  "invite-required":
    "This account is not invited yet. Use your invite link to sign in.",
  "profile-creation-failed":
    "We couldn't finish setting up your profile. Please try again.",
  "profile-fetch-failed":
    "We couldn't load your profile. Please sign in again.",
} as const;

export function LoginAlert() {
  const searchParams = useSearchParams();
  const inviteError = searchParams.get("invite_error");
  const authError = searchParams.get("error");
  const legacyInviteFlag = searchParams.get("invite");

  const inviteMessage =
    inviteError && inviteError in INVITE_ERROR_MESSAGES
      ? INVITE_ERROR_MESSAGES[inviteError as keyof typeof INVITE_ERROR_MESSAGES]
      : legacyInviteFlag === "invalid"
        ? INVITE_ERROR_MESSAGES.invalid_token
        : null;

  const authMessage =
    authError && authError in AUTH_ERROR_MESSAGES
      ? AUTH_ERROR_MESSAGES[authError as keyof typeof AUTH_ERROR_MESSAGES]
      : null;

  const message = inviteMessage ?? authMessage;
  if (!message) return null;

  return (
    <div className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2">
      <p className="type-small text-destructive">{message}</p>
    </div>
  );
}
