import "server-only";

import type { AppRouter } from "@v1/api/src/trpc/routers/_app";
import { createClient as createSupabaseServerClient } from "@v1/supabase/server";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { createTRPCClient, loggerLink } from "@trpc/client";
import { httpBatchLink } from "@trpc/client/links/httpBatchLink";
import {
  type TRPCQueryOptions,
  createTRPCOptionsProxy,
} from "@trpc/tanstack-react-query";
import { cache } from "react";
import superjson from "superjson";
import { makeQueryClient } from "./query-client";

export const getQueryClient = cache(makeQueryClient);

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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
          return {
            Authorization: session?.access_token
              ? `Bearer ${session.access_token}`
              : "",
          } as Record<string, string>;
        },
      }),
      loggerLink({
        enabled: (opts) =>
          process.env.NODE_ENV === "development" ||
          (opts.direction === "down" && opts.result instanceof Error),
      }),
    ],
  }),
});

export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return <HydrationBoundary state={dehydrate(queryClient)}>{props.children}</HydrationBoundary>;
}

export function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(
  queryOptions: T,
) {
  const queryClient = getQueryClient();
  if ((queryOptions as any).queryKey?.[1]?.type === "infinite") {
    void (queryClient as any).prefetchInfiniteQuery(queryOptions);
  } else {
    void queryClient.prefetchQuery(queryOptions as any);
  }
}

export function batchPrefetch<T extends ReturnType<TRPCQueryOptions<any>>>(
  queryOptionsArray: T[],
) {
  const queryClient = getQueryClient();
  for (const queryOptions of queryOptionsArray) {
    if ((queryOptions as any).queryKey?.[1]?.type === "infinite") {
      void (queryClient as any).prefetchInfiniteQuery(queryOptions);
    } else {
      void queryClient.prefetchQuery(queryOptions as any);
    }
  }
}


