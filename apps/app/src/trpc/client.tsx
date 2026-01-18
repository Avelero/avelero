"use client";

import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider, isServer } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@v1/api/src/trpc/routers/_app";
import { createClient as createSupabaseClient } from "@v1/supabase/client";
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

const apiUrl = process.env.NEXT_PUBLIC_API_URL as string;

interface TRPCReactProviderProps {
  children: React.ReactNode;
}

/**
 * tRPC + React Query provider for client components.
 *
 * This provider sets up QueryClient and tRPC client. It does NOT handle
 * hydration - that's done per-page via HydrateClient wrapper around
 * client components that consume prefetched data.
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr
 */
export function TRPCReactProvider({ children }: TRPCReactProviderProps) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() => {
    return createTRPCClient<AppRouter>({
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
            // During SSR of client components, Supabase browser client has no session
            // (no cookies/localStorage on server). Data should come from hydrated cache.
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
      ],
    });
  });

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
