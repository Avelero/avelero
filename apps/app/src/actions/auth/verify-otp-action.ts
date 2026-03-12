"use server";

import { actionClient } from "@/actions/safe-action";
import {
  BRAND_ACCESS_REMOVED_LOGIN_PATH,
  getForceSignOutPath,
  isInviteRequiredPath,
} from "@/lib/auth-access";
import { resolveAuthRedirectPath } from "@/lib/auth-redirect";
import {
  INVITE_COOKIE_NAME,
  redeemInviteFromCookie,
} from "@/lib/invite-redemption";
import { createClient } from "@v1/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
  token: z.string().length(6, "Verification code must be 6 digits"),
  redirectTo: z.string().default("/"),
});

function sanitizeRedirectPath(path: string | undefined): string {
  if (!path) return "/";
  try {
    // Reject protocol-relative URLs (//evil.com) and absolute URLs
    // Only check at the start to allow absolute URLs in query parameters
    if (path.startsWith("//") || /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(path)) {
      return "/";
    }
    // Normalize path: collapse any leading slashes to a single "/"
    if (path.startsWith("/")) {
      return `/${path.replace(/^\/+/, "")}`;
    }
    // Try parsing as URL and extract pathname
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

    const supabase = await createClient();

    // Verify OTP with Supabase
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (error) {
      const normalizedMessage = (error.message ?? "").toLowerCase();
      const hasExpired = normalizedMessage.includes("expired");
      const hasInvalid = normalizedMessage.includes("invalid");
      const hasAuthGateDenied =
        normalizedMessage.includes("auth_gate_denied") ||
        normalizedMessage.includes("auth gate denied") ||
        normalizedMessage.includes("invite_required") ||
        normalizedMessage.includes("invite required");
      const isRateLimited =
        error.status === 429 ||
        normalizedMessage.includes("too many requests") ||
        normalizedMessage.includes("rate limit") ||
        normalizedMessage.includes("for security purposes");

      if (hasAuthGateDenied) {
        throw new Error(
          "Your brand access has been removed, please contact your administrator.",
        );
      }

      if (isRateLimited) {
        throw new Error(
          "Too many attempts. Please wait a moment and try again.",
        );
      }

      if (hasExpired && hasInvalid) {
        throw new Error(
          "Verification code is invalid or has expired. Please request a new one.",
        );
      }

      if (hasInvalid) {
        throw new Error("Invalid verification code. Please try again.");
      }

      if (hasExpired) {
        throw new Error(
          "Verification code has expired. Please request a new one.",
        );
      }

      throw new Error(error.message || "Invalid verification code");
    }

    if (!data.session) {
      throw new Error("Authentication failed. Please try again.");
    }

    // Successful verification: redeem invite cookie if present, then compute final destination
    const user = data.user ?? data.session.user ?? null;
    const cookieStore = await cookies();
    const cookieHash = cookieStore.get(INVITE_COOKIE_NAME)?.value ?? null;

    const inviteRedemption = await redeemInviteFromCookie({
      cookieHash,
      user,
      client: supabase,
    });

    if (cookieHash && inviteRedemption.shouldClearCookie) {
      const cs = await cookies();
      cs.set(INVITE_COOKIE_NAME, "", { maxAge: 0, path: "/" });
    }

    const destination = await resolveAuthRedirectPath({
      next: sanitizeRedirectPath(redirectTo),
      client: supabase,
      user,
    });
    const finalDestination = isInviteRequiredPath(destination)
      ? getForceSignOutPath(`${BRAND_ACCESS_REMOVED_LOGIN_PATH}&provider=otp`)
      : destination;

    redirect(finalDestination);
  });
