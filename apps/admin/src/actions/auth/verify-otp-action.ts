"use server";

import { actionClient } from "@/actions/safe-action";
import { getPlatformAdminActorAccess } from "@/lib/platform-admin-access";
import { createClient } from "@v1/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";

const GENERIC_AUTH_ERROR = "Unable to sign in. Please contact your administrator.";
const INVALID_OTP_ERROR = "Invalid verification code. Please try again.";
const RATE_LIMITED_ERROR = "Too many attempts. Please wait a moment and try again.";

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
  token: z.string().length(6, "Verification code must be 6 digits"),
});

export const verifyOtpAction = actionClient
  .schema(schema)
  .action(async ({ parsedInput }) => {
    const { email, token } = parsedInput;
    const supabase = await createClient();

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (error) {
      const message = error.message.toLowerCase();
      if (
        error.status === 429 ||
        message.includes("too many requests") ||
        message.includes("rate limit") ||
        message.includes("for security purposes")
      ) {
        throw new Error(RATE_LIMITED_ERROR);
      }
      if (message.includes("invalid") || message.includes("expired")) {
        throw new Error(INVALID_OTP_ERROR);
      }
      throw new Error(GENERIC_AUTH_ERROR);
    }

    const access = await getPlatformAdminActorAccess(supabase);
    if (access.unavailable || !access.allowed) {
      await supabase.auth.signOut({ scope: "global" });
      throw new Error(GENERIC_AUTH_ERROR);
    }

    redirect("/");
  });
