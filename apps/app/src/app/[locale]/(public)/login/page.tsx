import { GoogleSignin } from "@/components/auth/google-signin";
import { OTPSignIn } from "@/components/auth/otp-signin";
import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Login",
};

export default function Page() {

  return (
    <div className="h-screen w-screen flex">
      {/* Left side - Auth forms */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6">
          {/* Logo */}
          <div className="text-center">
            <Image 
              src="/logo.png" 
              alt="logo" 
              width={120} 
              height={120} 
              className="mx-auto mb-8"
            />
          </div>

          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-semibold">Welcome</h1>
            <p className="text-muted-foreground font-mono text-sm">
              Sign in to your account or create a new one
            </p>
          </div>

          {/* Auth Forms */}
          <div className="space-y-4">
            {/* Google Sign-in */}
            <GoogleSignin />
            
            {/* Separator */}
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

            {/* OTP Sign-in */}
            <OTPSignIn />
          </div>
        </div>
      </div>

      {/* Right side - Placeholder */}
      <div className="flex-1 bg-muted flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl font-mono text-muted-foreground">
            Placeholder
          </p>
        </div>
      </div>
    </div>
  );
}