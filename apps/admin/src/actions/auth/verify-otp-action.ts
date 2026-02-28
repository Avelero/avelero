"use server";

import { actionClient } from "@/actions/safe-action";
import { isAdminEmailAllowed } from "@/lib/admin-allowlist";
import { createClient } from "@v1/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";

const GENERIC_AUTH_ERROR = "Unable to sign in. Please contact your administrator.";
const INVALID_OTP_ERROR = "Invalid verification code. Please try again.";

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
      if (message.includes("invalid") || message.includes("expired")) {
        throw new Error(INVALID_OTP_ERROR);
      }
      throw new Error(GENERIC_AUTH_ERROR);
    }

    const authenticatedEmail =
      data.user?.email?.toLowerCase() ??
      data.session?.user?.email?.toLowerCase() ??
      email.toLowerCase();

    if (!isAdminEmailAllowed(authenticatedEmail)) {
      await supabase.auth.signOut({ scope: "global" });
      throw new Error(GENERIC_AUTH_ERROR);
    }

    redirect("/");
  });
