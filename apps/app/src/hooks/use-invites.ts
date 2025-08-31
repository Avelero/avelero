"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

export function useMyInvitesQuery() {
  const trpc = useTRPC();
  const opts = trpc.brand.myInvites.queryOptions();
  return useQuery(opts as any);
}

export function useMyInvitesQuerySuspense() {
  const trpc = useTRPC();
  const opts = trpc.brand.myInvites.queryOptions();
  return useSuspenseQuery(opts as any);
}

export function useAcceptInviteMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.brand.acceptInvite.mutationOptions({
      onSuccess: async () => {
        // refresh invite inbox and memberships
        await queryClient.invalidateQueries({ queryKey: trpc.brand.myInvites.queryKey() });
        await queryClient.invalidateQueries({ queryKey: trpc.brand.list.queryKey() });
        await queryClient.invalidateQueries({ queryKey: trpc.user.me.queryKey() });
      },
    }),
  );
}

export function useRejectInviteMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.brand.rejectInvite.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: trpc.brand.myInvites.queryKey() });
      },
    }),
  );
}


