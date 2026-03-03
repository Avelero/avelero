import "server-only";

import { createClient } from "@v1/supabase/server";

export type MainAuthErrorCode =
  | "invite-required"
  | "brand-access-removed"
  | "auth-rate-limited"
  | "auth-unavailable";

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

type MainAuthStartPolicyDecision =
  | { ok: true }
  | { ok: false; errorCode: MainAuthErrorCode };

export async function evaluateMainOtpStartPolicy(
  email: string,
): Promise<MainAuthStartPolicyDecision> {
  const normalizedEmail = normalizeAuthEmail(email);
  if (!normalizedEmail) {
    return { ok: false, errorCode: "auth-unavailable" };
  }

  const admin = await createClient({ admin: true });

  const [
    allowlistResult,
    inviteResult,
    authUserResult,
    membershipResult,
  ] = await Promise.all([
    admin.rpc("has_platform_admin_email", { p_email: normalizedEmail }),
    admin.rpc("has_pending_invite_email", { p_email: normalizedEmail }),
    admin.rpc("has_auth_user_email", { p_email: normalizedEmail }),
    admin.rpc("has_brand_membership_email", { p_email: normalizedEmail }),
  ]);

  if (
    allowlistResult.error ||
    inviteResult.error ||
    authUserResult.error ||
    membershipResult.error
  ) {
    return { ok: false, errorCode: "auth-unavailable" };
  }

  const isAllowlisted = allowlistResult.data === true;
  const hasPendingInvite = inviteResult.data === true;
  const hasMembership = membershipResult.data === true;
  const hasExistingAccount = authUserResult.data === true;

  if (isAllowlisted || hasPendingInvite || hasMembership) {
    return { ok: true };
  }

  if (hasExistingAccount) {
    return { ok: false, errorCode: "brand-access-removed" };
  }

  return { ok: false, errorCode: "invite-required" };
}

type AuthOtpError = {
  message?: string;
  code?: string;
  status?: number;
} | null;

export function mapMainOtpStartSupabaseError(
  error: AuthOtpError,
): MainAuthErrorCode {
  const message = error?.message?.toLowerCase() ?? "";
  const code = error?.code?.toLowerCase() ?? "";

  if (error?.status === 429) {
    return "auth-rate-limited";
  }

  if (
    message.includes("too many requests") ||
    message.includes("rate limit") ||
    message.includes("for security purposes")
  ) {
    return "auth-rate-limited";
  }

  if (
    code === "invite_required" ||
    code === "auth_gate_denied" ||
    message.includes("invite_required") ||
    message.includes("invite required") ||
    message.includes("auth_gate_denied") ||
    message.includes("auth gate denied") ||
    message.includes("otp_disabled") ||
    message.includes("signups not allowed") ||
    message.includes("signup is disabled")
  ) {
    return "invite-required";
  }

  return "auth-unavailable";
}
