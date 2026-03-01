import {
  QueryClient,
  defaultShouldDehydrateQuery,
} from "@tanstack/react-query";
import superjson from "superjson";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 1000 * 60 * 5,
        refetchOnWindowFocus: process.env.NODE_ENV === "production",
        retry: 2,
        retryDelay: (attemptIndex: number): number =>
          Math.min(1000 * 2 ** attemptIndex, 30000),
      },
      dehydrate: {
        serializeData: superjson.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  });
}
