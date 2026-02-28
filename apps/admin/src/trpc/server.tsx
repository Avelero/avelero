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

const getAuthToken = cache(async () => {
  const headersList = await headers();
  return headersList.get(AUTH_TOKEN_HEADER);
});

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

export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}
