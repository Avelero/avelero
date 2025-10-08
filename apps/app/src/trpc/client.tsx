"use client";

import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider, isServer } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@v1/api/src/trpc/routers/_app";
import { createClient as createSupabaseClient } from "@v1/supabase/client";
// API base URL is configured via NEXT_PUBLIC_API_URL per environment
import { useState } from "react";
import superjson from "superjson";
import { makeQueryClient } from "./query-client";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

let browserQueryClient: QueryClient;

function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

const getApiUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  
  // Fallback logic for production
  if (!envUrl) {
    if (typeof window !== 'undefined') {
      // Client-side fallback
  console.warn('NEXT_PUBLIC_API_URL not found, using fallback');
      return 'https://avelero-api.fly.dev';
    }
    // Server-side fallback
    return 'https://avelero-api.fly.dev';
  }
  
  return envUrl;
};

const apiUrl = getApiUrl();

// Validate API URL in development
if (process.env.NODE_ENV === "development" && !process.env.NEXT_PUBLIC_API_URL) {
  console.error("NEXT_PUBLIC_API_URL is not set");
}

if (process.env.NODE_ENV === "development") {
  console.log("tRPC API URL:", `${apiUrl}/trpc`);
}

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${apiUrl}/trpc`,
          // @ts-expect-error - SuperJSON transformer is compatible but types don't match exactly
          transformer: superjson,
          async headers() {
            const supabase = createSupabaseClient();
            const {
              data: { session },
            } = await supabase.auth.getSession();
            const token = session?.access_token;
            return token
              ? ({ Authorization: `Bearer ${token}` } as Record<string, string>)
              : ({} as Record<string, string>);
          },
          fetch: async (url, opts) => {
            try {
              const response = await fetch(url, opts);

              // Log response details in development
              if (process.env.NODE_ENV === "development") {
                console.log(`tRPC ${opts?.method || 'GET'}`, url, {
                  status: response.status,
                  statusText: response.statusText,
                  headers: Object.fromEntries(response.headers.entries()),
                });
              }

              // Only check for explicitly empty responses (content-length: 0)
              // Don't throw on null content-length as it's valid for chunked responses
              if (response.status === 200) {
                const contentLength = response.headers.get('content-length');
                if (contentLength === '0') {
                  console.error('Empty response from API:', url);
                  throw new Error('Empty response from API server');
                }
              }

              return response;
            } catch (error) {
              console.error('tRPC fetch error:', error, 'URL:', url);
              throw error;
            }
          },
        }),
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === "development" ||
            (opts.direction === "down" && opts.result instanceof Error),
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {props.children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
