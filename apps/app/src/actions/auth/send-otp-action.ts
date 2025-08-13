"use server";

import { createClient } from "@v1/supabase/server";
import { z } from "zod";

const sendOtpSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export async function sendOtpAction(email: string) {
  try {
    // Validate input
    const result = sendOtpSchema.safeParse({ email });
    if (!result.success) {
      return {
        error: result.error.errors[0]?.message || "Invalid email address",
      };
    }

    const supabase = await createClient();
    
    // Send OTP via Supabase
    const { error } = await supabase.auth.signInWithOtp({
      email: result.data.email,
      options: {
        // This will trigger the webhook to send the email
        shouldCreateUser: true,
      },
    });

    if (error) {
      console.error("Send OTP error:", error);
      return {
        error: error.message || "Failed to send verification code",
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("Send OTP action error:", error);
    return {
      error: "Failed to send verification code. Please try again.",
    };
  }
}