import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../types";

export const createClient = () => {
  // Guard against SSR - only create browser client in browser environment
  if (typeof window === 'undefined') {
    throw new Error(
      'createClient() is a browser-only function. Use createServerClient() for server-side code.'
    );
  }

  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return document.cookie
            .split('; ')
            .find(row => row.startsWith(`${name}=`))
            ?.split('=')[1];
        },
        set(name: string, value: string, options: any) {
          document.cookie = `${name}=${value}; path=/; ${options.maxAge ? `max-age=${options.maxAge}` : ''}; SameSite=Lax; Secure`;
        },
        remove(name: string, options: any) {
          document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax; Secure`;
        },
      },
    }
  );
};
