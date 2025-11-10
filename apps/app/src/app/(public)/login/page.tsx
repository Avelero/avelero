import { GoogleSignin } from "@/components/auth/google-signin";
import { OTPSignIn } from "@/components/auth/otp-signin";
import type { Metadata } from "next";
import Image from "next/image";
import loginPageImage from "public/marketing/login-page-image.webp";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Login | Avelero",
};

export default function Page() {
  return (
    <div className="h-screen w-screen flex p-2">
      {/* Left side - Auth forms */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h3 className="text-primary">Welcome</h3>
            <p className="text-secondary">
              Sign in to your account or create a new one
            </p>
          </div>

          {/* Auth Forms */}
          <div className="space-y-4">
            {/* Google Sign-in */}
            <Suspense fallback={<div className="h-10 animate-pulse bg-muted rounded-md" />}>
              <GoogleSignin />
            </Suspense>

            {/* Separator */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center uppercase">
                <span className="bg-background px-2 type-small text-secondary">
                  Or continue with
                </span>
              </div>
            </div>

            {/* OTP Sign-in */}
            <Suspense fallback={<div className="h-32 animate-pulse bg-muted rounded-md" />}>
              <OTPSignIn />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Background Image Section - Hidden on mobile, visible on desktop */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <Image
          src={loginPageImage}
          alt="Background image"
          className="object-cover object-left"
          priority
          fill
        />
      </div>
    </div>
  );
}
