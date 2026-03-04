import {
  QueryClient,
  defaultShouldDehydrateQuery,
  isServer,
} from "@tanstack/react-query";
import superjson from "superjson";

/**
 * Creates a configured QueryClient with request deduplication and caching.
 *
 * @returns QueryClient instance optimized for tRPC with batching support.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        /**
         * Keep data fresh for 60 seconds to prevent unnecessary refetches.
         * Queries within this window reuse cached data instead of refetching.
         */
        staleTime: 2 * 60 * 1000,
        /**
         * Deduplicate identical requests within 1 second.
         * Prevents triple-render behavior from triggering multiple network calls.
         */
        gcTime: 10 * 60 * 1000,
        /**
         * Avoid server-side retry stalls; keep moderate retries on the client.
         */
        retry: isServer ? 0 : 2,
      },
      dehydrate: {
        serializeData: superjson.serialize,
        /**
         * Include pending queries in dehydration for streaming SSR.
         * This matches the official TanStack Query example:
         * @see https://tanstack.com/query/latest/docs/framework/react/examples/nextjs-app-prefetching
         *
         * With HydrateClient at the page level (after prefetches start),
         * pending queries will stream their results to the client.
         */
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  });
}
