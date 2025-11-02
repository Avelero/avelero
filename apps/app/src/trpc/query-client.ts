import {
  QueryClient,
  defaultShouldDehydrateQuery,
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
        staleTime: 60 * 1000,
        /**
         * Deduplicate identical requests within 1 second.
         * Prevents triple-render behavior from triggering multiple network calls.
         */
        gcTime: 1000 * 60 * 5, // 5 minutes garbage collection
        /**
         * Disable automatic refetch on window focus during development.
         * Reduces noise when switching between editor and browser.
         */
        refetchOnWindowFocus: process.env.NODE_ENV === "production",
        /**
         * Enable retry with exponential backoff for transient failures.
         */
        retry: 3,
        retryDelay: (attemptIndex: number): number =>
          Math.min(1000 * 2 ** attemptIndex, 30000),
      },
      dehydrate: {
        serializeData: superjson.serialize,
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
