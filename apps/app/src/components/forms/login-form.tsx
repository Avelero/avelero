"use client";

import { GoogleSignin } from "@/components/auth/google-signin";
import { EmailSignin } from "@/components/auth/email-signin";
import { OtpVerify } from "@/components/auth/otp-verify";
import { sendOtpAction } from "@/actions/auth/send-otp-action";
import { verifyOtpAction } from "@/actions/auth/verify-otp-action";
import { useState } from "react";

export function LoginForm() {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");

  const handleEmailSubmit = async (emailValue: string) => {
    setIsLoading(true);
    setError("");
    setEmail(emailValue);
    
    try {
      const result = await sendOtpAction(emailValue);
      
      if (result.error) {
        setError(result.error);
        setIsLoading(false);
        return;
      }
      
      // Success - transition to OTP step
      setStep("otp");
      setIsLoading(false);
    } catch (err) {
      setError("Failed to send verification code. Please try again.");
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (otp: string): Promise<void> => {
    setIsLoading(true);
    setError("");
    
    try {
      const result = await verifyOtpAction(email, otp);
      
      if (result?.error) {
        setError(result.error);
        setIsLoading(false);
        return;
      }
      
      // Success - verifyOtpAction handles redirect
      setIsLoading(false);
    } catch (err) {
      setError("Invalid verification code. Please try again.");
      setIsLoading(false);
    }
  };

  const handleResend = async (): Promise<void> => {
    setIsResending(true);
    setError("");
    
    try {
      const result = await sendOtpAction(email);
      
      if (result.error) {
        setError(result.error);
      } else {
        // Clear any existing OTP input on successful resend
        // The OtpVerify component will handle clearing its state
      }
      
      setIsResending(false);
    } catch (err) {
      setError("Failed to resend code. Please try again.");
      setIsResending(false);
    }
  };

  const handleBack = () => {
    setStep("email");
    setError("");
  };

  return (
    <div className="space-y-4">
      {/* Google Sign-in - Always visible */}
      <GoogleSignin />
      
      {/* Separator - Always visible */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground font-mono">
            Or continue with
          </span>
        </div>
      </div>

      {/* Email input or OTP verification */}
      {step === "email" ? (
        <EmailSignin 
          onEmailSubmit={handleEmailSubmit}
          isLoading={isLoading}
        />
      ) : (
        <OtpVerify
          email={email}
          onOtpSubmit={handleOtpSubmit}
          onBack={handleBack}
          onResend={handleResend}
          isLoading={isLoading}
          isResending={isResending}
          error={error}
        />
      )}
    </div>
  );
}