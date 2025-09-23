"use client";

import { useTRPC } from "@/trpc/client";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createClient as createSupabaseClient } from "@v1/supabase/client";

function useIsSessionReady(): boolean {
  if (typeof window === "undefined") return true;
  const supabase = createSupabaseClient();
  // We can't subscribe synchronously without state; assume presence if local storage has a token
  // Minimal: check access_token in memory via getSession() lazily handled by query enabled flag
  return !!supabase;
}

export function useUserQuery() {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.user.me.queryOptions());
}

export interface CurrentUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null; // legacy
  avatar_path: string | null; // new
  avatar_hue: number | null;
  brand_id: string | null;
}

export function useUserQuerySuspense() {
  const trpc = useTRPC();
  const isSessionReady =
    typeof window === "undefined" ? true : !!window?.localStorage;
  const opts = trpc.user.me.queryOptions();
  // Suspense queries are always enabled; avoid passing `enabled`
  return useSuspenseQuery({
    ...opts,
  });
}

export function useUserMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.user.update.mutationOptions({
      onMutate: async (newData) => {
        // Cancel outgoing refetches
        await queryClient.cancelQueries({
          queryKey: trpc.user.me.queryKey(),
        });

        // Get current data
        const previousData = queryClient.getQueryData(trpc.user.me.queryKey());

        // Optimistically update
        queryClient.setQueryData(trpc.user.me.queryKey(), (old) => {
          const prev = old as CurrentUser | null | undefined;
          const patch = newData as Partial<CurrentUser>;
          return prev
            ? { ...prev, ...patch }
            : (patch as unknown as CurrentUser) ?? null;
        });

        return { previousData } as const;
      },
      onError: (_err, _vars, context) => {
        // Rollback on error
        const previous = (
          context as { previousData: CurrentUser | null } | undefined
        )?.previousData;
        queryClient.setQueryData(trpc.user.me.queryKey(), previous);
      },
      onSettled: () => {
        // Refetch after error or success
        queryClient.invalidateQueries({
          queryKey: trpc.user.me.queryKey(),
        });
      },
    }),
  );
}
