import { LoginForm } from "@/components/login-form";
import Image from "next/image";

export const metadata = {
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
          <LoginForm />
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