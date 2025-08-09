"use server";

import { createClient } from "@v1/supabase/server";
import { cookies } from "next/headers";
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

    const supabase = createClient();
    
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

    // Set preferred sign-in method cookie (expires in 1 year)
    const cookieStore = cookies();
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    
    cookieStore.set("preferred-signin-provider", "otp", {
      expires: expiryDate,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

  } catch (error) {
    console.error("Verify OTP action error:", error);
    return {
      error: "Failed to verify code. Please try again.",
    };
  }
  // Successful verification: compute the final destination here using shared policy
  const supabase = createClient();
  const destination = await resolveAuthRedirectPath(supabase, { next: "/" });
  redirect(destination);
}