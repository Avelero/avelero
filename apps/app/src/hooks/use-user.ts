"use client";

import { useTRPC } from "@/trpc/client";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";

export function useUserQuery() {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.user.get.queryOptions());
}

export interface CurrentUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  brand_id: string | null;
}

export function useUserQuerySuspense() {
  const trpc = useTRPC();
  const opts = trpc.user.get.queryOptions();
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
          queryKey: trpc.user.get.queryKey(),
        });

        // Get current data
        const previousData = queryClient.getQueryData(
          trpc.user.get.queryKey(),
        );

        // Optimistically update
        queryClient.setQueryData(trpc.user.get.queryKey(), (old) => {
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
        queryClient.setQueryData(trpc.user.get.queryKey(), previous);
      },
      onSettled: () => {
        // Refetch after error or success
        queryClient.invalidateQueries({
          queryKey: trpc.user.get.queryKey(),
        });
      },
    }),
  );
}
