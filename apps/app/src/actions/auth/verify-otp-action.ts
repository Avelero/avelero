"use server";

import { actionClient } from "@/actions/safe-action";
import { resolveAuthRedirectPath } from "@/lib/auth-redirect";
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
    // Only allow relative paths
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
      if (error.message.includes("expired")) {
        throw new Error(
          "Verification code has expired. Please request a new one.",
        );
      }
      if (error.message.includes("invalid")) {
        throw new Error("Invalid verification code. Please try again.");
      }

      throw new Error(error.message || "Invalid verification code");
    }

    if (!data.session || !data.user) {
      throw new Error("Authentication failed. Please try again.");
    }

    // Successful verification: redeem invite cookie if present, then compute final destination
    // Use data.user from verifyOtp response - no need for extra getUser() call
    const user = data.user;
    const cookieStore = await cookies();
    const cookieHash =
      cookieStore.get("brand_invite_token_hash")?.value ?? null;
    let acceptedBrand = false;

    if (cookieHash) {
      try {
        const { error: rpcError } = await supabase.rpc(
          "accept_invite_from_cookie",
          { p_token: cookieHash },
        );
        if (!rpcError) acceptedBrand = true;
      } finally {
        // clear cookie regardless
        const cs = await cookies();
        cs.set("brand_invite_token_hash", "", { maxAge: 0, path: "/" });
      }
    }

    const destination = acceptedBrand
      ? "/"
      : await resolveAuthRedirectPath({
          next: sanitizeRedirectPath(redirectTo),
        });

    redirect(destination);
  });
