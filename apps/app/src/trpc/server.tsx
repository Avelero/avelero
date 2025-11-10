import "server-only";

import type { AppRouter } from "@v1/api/src/trpc/routers/_app";
import { createClient as createSupabaseServerClient } from "@v1/supabase/server";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import {
  type TRPCQueryOptions,
  createTRPCOptionsProxy,
} from "@trpc/tanstack-react-query";
import { cache } from "react";
import superjson from "superjson";
import { makeQueryClient } from "./query-client";

export const getQueryClient = cache(makeQueryClient);

const apiUrl = process.env.NEXT_PUBLIC_API_URL as string;

export const trpc = createTRPCOptionsProxy<AppRouter>({
  queryClient: getQueryClient,
  client: createTRPCClient({
    links: [
      httpBatchLink({
        url: `${apiUrl}/trpc`,
        transformer: superjson,
        async headers() {
          const supabase = await createSupabaseServerClient();
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
        enabled: (opts: { direction: "up" | "down"; result?: unknown }) =>
          process.env.NODE_ENV === "development" ||
          (opts.direction === "down" && opts.result instanceof Error),
        logger: (opts) => {
          // Use default console logging
          const defaultLogger =
            typeof window === "undefined" ? console : console;
          defaultLogger.log(opts);
        },
      }),
    ],
  }),
});

export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}

export function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(
  queryOptions: T,
) {
  const queryClient = getQueryClient();

  if (queryOptions.queryKey[1]?.type === "infinite") {
    void queryClient.prefetchInfiniteQuery(queryOptions as any);
  } else {
    void queryClient.prefetchQuery(queryOptions);
  }
}

export function batchPrefetch<
  T extends ReturnType<TRPCQueryOptions<any>>,
>(queryOptionsArray: T[]) {
  const queryClient = getQueryClient();

  for (const queryOptions of queryOptionsArray) {
    if (queryOptions.queryKey[1]?.type === "infinite") {
      void queryClient.prefetchInfiniteQuery(queryOptions as any);
    } else {
      void queryClient.prefetchQuery(queryOptions);
    }
  }
}
