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

export function TRPCReactProvider({ children }: TRPCReactProviderProps) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() => {
    return createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${apiUrl}/trpc`,
          transformer: superjson,
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
