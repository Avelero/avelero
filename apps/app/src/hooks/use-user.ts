"use client";

import { useTRPC } from "@/trpc/client";
import { createClient as createSupabaseClient } from "@v1/supabase/client";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";

function useIsSessionReady(): boolean {
  if (typeof window === "undefined") return true;
  const supabase = createSupabaseClient();
  // We can't subscribe synchronously without state; assume presence if local storage has a token
  // Minimal: check access_token in memory via getSession() lazily handled by query enabled flag
  return !!(supabase as any);
}

export function useUserQuery() {
  const trpc = useTRPC();
  const isSessionReady = typeof window === "undefined" ? true : !!window?.localStorage;
  const opts = trpc.user.me.queryOptions();
  return useQuery({ ...(opts as any), enabled: typeof window !== "undefined" && isSessionReady } as any);
}

export interface CurrentUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;   // legacy
  avatar_path: string | null;  // new
  avatar_hue: number | null;
  brand_id: string | null;
}

export function useUserQuerySuspense() {
  const trpc = useTRPC();
  const isSessionReady = typeof window === "undefined" ? true : !!window?.localStorage;
  const opts = trpc.user.me.queryOptions();
  return useSuspenseQuery({ ...(opts as any), enabled: typeof window !== "undefined" && isSessionReady } as any);
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
        queryClient.setQueryData(trpc.user.me.queryKey(), (old: any) => ({
          ...old,
          ...newData,
        }));

        return { previousData };
      },
      onError: (_, __, context) => {
        // Rollback on error
        queryClient.setQueryData(
          trpc.user.me.queryKey(),
          context?.previousData,
        );
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