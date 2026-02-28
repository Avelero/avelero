import { GoogleSignin } from "@/components/auth/google-signin";
import { OTPSignIn } from "@/components/auth/otp-signin";
import {
  ADMIN_LOGIN_ERROR_COOKIE,
  getLoginErrorMessage,
} from "@/lib/login-error";
import type { Metadata } from "next";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "Login | Avelero Admin",
};

export default async function Page() {
  const cookieStore = await cookies();
  const loginErrorMessage = getLoginErrorMessage(
    cookieStore.get(ADMIN_LOGIN_ERROR_COOKIE)?.value,
  );

  return (
    <div className="h-screen w-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 border p-6 bg-background">
        <div className="text-center space-y-2">
          <h4 className="text-primary">Avelero Admin</h4>
          <p className="text-secondary">
            Sign in with an authorized founder account.
          </p>
        </div>

        <div className="space-y-4">
          <GoogleSignin initialErrorMessage={loginErrorMessage} />

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

          <OTPSignIn />
        </div>
      </div>
    </div>
  );
}
