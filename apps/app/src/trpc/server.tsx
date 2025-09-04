import "server-only";

import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import {
  type TRPCQueryOptions,
  createTRPCOptionsProxy,
} from "@trpc/tanstack-react-query";
import type { AppRouter } from "@v1/api/src/trpc/routers/_app";
import { createClient as createSupabaseServerClient } from "@v1/supabase/server";
import { getApiUrl } from "@v1/utils/envs";
import { cache } from "react";
import superjson from "superjson";
import { makeQueryClient } from "./query-client";

export const getQueryClient = cache(makeQueryClient);

const apiUrl = getApiUrl();

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
          // Attempt refresh if session missing or expired/near expiry
          let token = session?.access_token ?? null;
          const expiresAtSec = session?.expires_at ?? 0;
          const nowSec = Math.floor(Date.now() / 1000);
          if (!token || expiresAtSec - nowSec < 60) {
            try {
              const { data: refreshed } = await supabase.auth.refreshSession();
              token = refreshed.session?.access_token ?? token;
            } catch {
              // ignore; we'll send without Authorization if still missing
            }
          }
          return token
            ? ({ Authorization: `Bearer ${token}` } as Record<string, string>)
            : ({} as Record<string, string>);
        },
      }),
      loggerLink({
        enabled: (opts: { direction: "up" | "down"; result?: unknown }) =>
          process.env.NODE_ENV === "development" ||
          (opts.direction === "down" && opts.result instanceof Error),
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

export async function prefetch<T>(queryOptions: T) {
  const queryClient = getQueryClient();
  const qo = queryOptions as { queryKey?: unknown[] };
  const second =
    (qo.queryKey?.[1] as { type?: string } | undefined) ?? undefined;
  const isInfinite = second?.type === "infinite";
  if (isInfinite) {
    await queryClient.prefetchInfiniteQuery(
      queryOptions as Parameters<
        (typeof queryClient)["prefetchInfiniteQuery"]
      >[0],
    );
  } else {
    await queryClient.prefetchQuery(
      queryOptions as Parameters<(typeof queryClient)["prefetchQuery"]>[0],
    );
  }
}

export async function batchPrefetch<T>(queryOptionsArray: T[]) {
  const queryClient = getQueryClient();
  await Promise.all(
    queryOptionsArray.map(async (queryOptions) => {
      const qo = queryOptions as { queryKey?: unknown[] };
      const second =
        (qo.queryKey?.[1] as { type?: string } | undefined) ?? undefined;
      const isInfinite = second?.type === "infinite";
      if (isInfinite) {
        await queryClient.prefetchInfiniteQuery(
          queryOptions as Parameters<
            (typeof queryClient)["prefetchInfiniteQuery"]
          >[0],
        );
      } else {
        await queryClient.prefetchQuery(
          queryOptions as Parameters<(typeof queryClient)["prefetchQuery"]>[0],
        );
      }
    }),
  );
}
