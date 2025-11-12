import { type CookieOptions, createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

export async function updateSession(
  request: NextRequest,
  response: NextResponse,
) {
  createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Ensure proper cookie options for Vercel preview deployments
          const cookieOptions = {
            ...options,
            sameSite: "lax" as const,
            secure: process.env.NODE_ENV === "production",
          };
          request.cookies.set({ name, value, ...cookieOptions });
          response.cookies.set({ name, value, ...cookieOptions });
        },
        remove(name: string, options: CookieOptions) {
          const cookieOptions = {
            ...options,
            sameSite: "lax" as const,
            secure: process.env.NODE_ENV === "production",
          };
          request.cookies.set({ name, value: "", ...cookieOptions });
          response.cookies.set({ name, value: "", ...cookieOptions });
        },
      },
    },
  );

  return response;
}
