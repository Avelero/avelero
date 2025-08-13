"use server";

import { createClient } from "@v1/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { resolveAuthRedirectPath } from "@/lib/auth-redirect";

const verifyOtpSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  token: z.string().length(6, "Verification code must be 6 digits"),
});

export async function verifyOtpAction(email: string, token: string) {
  try {
    // Validate input
    const result = verifyOtpSchema.safeParse({ email, token });
    if (!result.success) {
      return {
        error: result.error.errors[0]?.message || "Invalid input",
      };
    }

    const supabase = await createClient();
    
    // Verify OTP with Supabase
    const { data, error } = await supabase.auth.verifyOtp({
      email: result.data.email,
      token: result.data.token,
      type: "email",
    });

    if (error) {
      console.error("Verify OTP error:", error);
      
      // Provide user-friendly error messages
      if (error.message.includes("expired")) {
        return {
          error: "Verification code has expired. Please request a new one.",
        };
      }
      if (error.message.includes("invalid")) {
        return {
          error: "Invalid verification code. Please try again.",
        };
      }
      
      return {
        error: error.message || "Invalid verification code",
      };
    }

    if (!data.session) {
      return {
        error: "Authentication failed. Please try again.",
      };
    }

  } catch (error) {
    console.error("Verify OTP action error:", error);
    return {
      error: "Failed to verify code. Please try again.",
    };
  }
  // Successful verification: claim invites then compute final destination
  const supabase = await createClient();
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
  const destination = await resolveAuthRedirectPath(supabase, { next: "/" });
  redirect(destination);
}