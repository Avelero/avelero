"use server";

import { createClient } from "@v1/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { resolveAuthRedirectPath } from "@/lib/auth-redirect";
import { actionClient } from "@/actions/safe-action";

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
      // Provide user-friendly error messages
      if (error.message.includes("expired")) {
        throw new Error("Verification code has expired. Please request a new one.");
      }
      if (error.message.includes("invalid")) {
        throw new Error("Invalid verification code. Please try again.");
      }
      
      throw new Error(error.message || "Invalid verification code");
    }

    if (!data.session) {
      throw new Error("Authentication failed. Please try again.");
    }

    // Successful verification: claim invites then compute final destination
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user ?? null;
    if (user) {
      try {
        await supabase.rpc("claim_invites_for_user", { p_user_id: user.id });
        // Ensure active brand is set to the most recent membership
        const { data: recentMembership } = await supabase
          .from("users_on_brand")
          .select("brand_id, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const selectedBrandId = recentMembership?.brand_id ?? null;
        if (selectedBrandId) {
          await supabase.from("users").update({ brand_id: selectedBrandId }).eq("id", user.id);
        }
      } catch (e) {
        // ignore failures; redirect policy will still work
      }
    }

    const destination = await resolveAuthRedirectPath(supabase, { 
      next: sanitizeRedirectPath(redirectTo) 
    });
    redirect(destination);
  });