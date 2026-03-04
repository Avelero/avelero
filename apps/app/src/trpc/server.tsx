import "server-only";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { createTRPCClient, httpLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@v1/api/src/trpc/routers/_app";
import { AUTH_TOKEN_HEADER } from "@v1/supabase/proxy";
import { headers } from "next/headers";
import { cache } from "react";
import superjson from "superjson";
import { makeQueryClient } from "./query-client";

export const getQueryClient = cache(makeQueryClient);

const apiUrl =
  (process.env.API_INTERNAL_URL as string | undefined) ??
  (process.env.NEXT_PUBLIC_API_URL as string);

const SSR_FETCH_TIMEOUT_MS = 8_000;

/**
 * Get the auth token from request headers.
 * This is cached per-request via React's cache() to ensure consistency
 * across all tRPC calls within the same request.
 */
const getAuthToken = cache(async () => {
  const headersList = await headers();
  return headersList.get(AUTH_TOKEN_HEADER);
});

/**
 * Custom fetch that adds auth headers for each request.
 * This is called for every HTTP request, ensuring auth is always included.
 */
async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(SSR_FETCH_TIMEOUT_MS);
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;

  const token = await getAuthToken();
  const requestHeaders = new Headers(init?.headers);

  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  // Prevent stale keep-alive sockets when using internal API networking.
  if (process.env.API_INTERNAL_URL) {
    requestHeaders.set("Connection", "close");
  }

  return fetch(input, {
    ...init,
    signal,
    headers: requestHeaders,
  });
}

/**
 * Server-side tRPC client.
 * Uses custom fetch to ensure auth headers are added to every request.
 */
export const trpc = createTRPCOptionsProxy<AppRouter>({
  queryClient: getQueryClient,
  client: createTRPCClient({
    links: [
      httpLink({
        url: `${apiUrl}/trpc`,
        transformer: superjson,
        fetch: fetchWithAuth,
      }),
    ],
  }),
});

/**
 * Hydration wrapper for server-prefetched data.
 *
 * Use this in each page/layout that prefetches data to transfer the
 * server QueryClient's cached data to client components.
 *
 * Per TanStack Query docs: "In the SSR guide, we noted that you could get rid
 * of the boilerplate of having <HydrationBoundary> in every route. This is
 * not possible with Server Components."
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr
 *
 * Start prefetches first, then render HydrateClient.
 */
export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}

/**
 * Prefetch a query on the server.
 *
 * Starts a query prefetch without blocking route rendering.
 */
export function prefetch<T>(queryOptions: T) {
  const queryClient = getQueryClient();
  const qo = queryOptions as { queryKey?: unknown[] };
  const second =
    (qo.queryKey?.[1] as { type?: string } | undefined) ?? undefined;
  const isInfinite = second?.type === "infinite";
  if (isInfinite) {
    void queryClient
      .prefetchInfiniteQuery(
        queryOptions as Parameters<
          (typeof queryClient)["prefetchInfiniteQuery"]
        >[0],
      )
      .catch(() => {
        // Avoid unhandled promise rejections from fire-and-forget prefetches.
      });
  } else {
    void queryClient
      .prefetchQuery(
        queryOptions as Parameters<(typeof queryClient)["prefetchQuery"]>[0],
      )
      .catch(() => {
        // Avoid unhandled promise rejections from fire-and-forget prefetches.
      });
  }
}

/**
 * Starts multiple query prefetches without blocking route rendering.
 */
export function batchPrefetch<T>(queryOptionsArray: T[]) {
  const queryClient = getQueryClient();
  for (const queryOptions of queryOptionsArray) {
    const qo = queryOptions as { queryKey?: unknown[] };
    const second =
      (qo.queryKey?.[1] as { type?: string } | undefined) ?? undefined;
    const isInfinite = second?.type === "infinite";

    if (isInfinite) {
      void queryClient
        .prefetchInfiniteQuery(
          queryOptions as Parameters<
            (typeof queryClient)["prefetchInfiniteQuery"]
          >[0],
        )
        .catch(() => {
          // Avoid unhandled promise rejections from fire-and-forget prefetches.
        });
    } else {
      void queryClient
        .prefetchQuery(
          queryOptions as Parameters<(typeof queryClient)["prefetchQuery"]>[0],
        )
        .catch(() => {
          // Avoid unhandled promise rejections from fire-and-forget prefetches.
        });
    }
  }
}
