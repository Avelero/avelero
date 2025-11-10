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

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient(): QueryClient {
  // Since this is a client component ("use client"), we always create a singleton
  // The isServer check from @tanstack/react-query is for SSR of client components,
  // but we want a stable singleton even during SSR to ensure consistent hydration
  if (typeof window === "undefined") {
    // During SSR, always create a new instance
    return makeQueryClient();
  }
  
  // On the client, use a singleton
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL as string;

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${apiUrl}/trpc`,
          transformer: superjson,
          /**
           * Configure batching to deduplicate requests during React's multiple renders.
           * maxURLLength prevents GET requests from exceeding server limits.
           */
          maxURLLength: 2083,
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
