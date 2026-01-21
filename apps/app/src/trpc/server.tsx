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

const apiUrl = process.env.NEXT_PUBLIC_API_URL as string;

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
  const token = await getAuthToken();
  const authHeaders: HeadersInit = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  return fetch(input, {
    ...init,
    headers: {
      ...init?.headers,
      ...authHeaders,
    },
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
 * @example
 * ```tsx
 * // In a server component page
 * await batchPrefetch([trpc.products.list.queryOptions()]);
 * return (
 *   <HydrateClient>
 *     <ProductList /> // Client component uses useSuspenseQuery
 *   </HydrateClient>
 * );
 * ```
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
 * Errors are caught and logged rather than thrown to prevent auth failures
 * during RSC navigation from breaking the entire page. If prefetch fails,
 * the client will refetch with client-side auth.
 */
export async function prefetch<T>(queryOptions: T) {
  const queryClient = getQueryClient();
  const qo = queryOptions as { queryKey?: unknown[] };
  const second =
    (qo.queryKey?.[1] as { type?: string } | undefined) ?? undefined;
  const isInfinite = second?.type === "infinite";
  try {
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
  } catch (error) {
    // Log but don't throw - let the client refetch if server prefetch fails
    console.error("[prefetch] Server prefetch failed:", error);
  }
}

/**
 * Prefetch multiple queries on the server in parallel.
 *
 * Errors are caught and logged rather than thrown to prevent auth failures
 * during RSC navigation from breaking the entire page. If prefetch fails,
 * the client will refetch with client-side auth.
 */
export async function batchPrefetch<T>(queryOptionsArray: T[]) {
  const queryClient = getQueryClient();
  await Promise.all(
    queryOptionsArray.map(async (queryOptions) => {
      const qo = queryOptions as { queryKey?: unknown[] };
      const second =
        (qo.queryKey?.[1] as { type?: string } | undefined) ?? undefined;
      const isInfinite = second?.type === "infinite";
      try {
        if (isInfinite) {
          await queryClient.prefetchInfiniteQuery(
            queryOptions as Parameters<
              (typeof queryClient)["prefetchInfiniteQuery"]
            >[0],
          );
        } else {
          await queryClient.prefetchQuery(
            queryOptions as Parameters<
              (typeof queryClient)["prefetchQuery"]
            >[0],
          );
        }
      } catch (error) {
        // Log but don't throw - let the client refetch if server prefetch fails
        console.error("[batchPrefetch] Server prefetch failed:", error);
      }
    }),
  );
}
