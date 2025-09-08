"use client";

import { useTRPC } from "@/trpc/client";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@v1/api/src/trpc/routers/_app";
import { toast } from "@v1/ui/sonner";

export function useMyInvitesQuery() {
  const trpc = useTRPC();
  const opts = trpc.brand.myInvites.queryOptions();
  return useQuery(opts);
}

export function useMyInvitesQuerySuspense() {
  const trpc = useTRPC();
  const opts = trpc.brand.myInvites.queryOptions();
  return useSuspenseQuery(opts);
}

export function useAcceptInviteMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  type RouterOutputs = inferRouterOutputs<AppRouter>;
  type MyInvites = RouterOutputs["brand"]["myInvites"];
  return useMutation(
    trpc.brand.acceptInvite.mutationOptions({
      onMutate: async (variables) => {
        await queryClient.cancelQueries({
          queryKey: trpc.brand.myInvites.queryKey(),
        });
        const previous = queryClient.getQueryData<MyInvites | undefined>(
          trpc.brand.myInvites.queryKey(),
        );

        // Find the invite to get brand name for toast
        const invite = previous?.data.find((i) => i.id === variables.id);
        const brandName = invite?.brand?.name || "brand";

        queryClient.setQueryData<MyInvites | undefined>(
          trpc.brand.myInvites.queryKey(),
          (old) =>
            old
              ? {
                  data: old.data.filter((i) => i.id !== variables.id),
                }
              : old,
        );

        return { previous, brandName } as const;
      },
      onError: (_err, _vars, ctx) => {
        queryClient.setQueryData(
          trpc.brand.myInvites.queryKey(),
          ctx?.previous,
        );
        toast.error("Action failed, please try again");
      },
      onSuccess: (_data, _vars, ctx) => {
        const brandName = ctx?.brandName || "brand";
        toast.success(`Accepted invite from ${brandName}`);
      },
      onSettled: async () => {
        // refresh invite inbox and memberships
        await queryClient.invalidateQueries({
          queryKey: trpc.brand.myInvites.queryKey(),
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.brand.list.queryKey(),
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.user.me.queryKey(),
        });
      },
    }),
  );
}

export function useRejectInviteMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  type RouterOutputs = inferRouterOutputs<AppRouter>;
  type MyInvites = RouterOutputs["brand"]["myInvites"];
  return useMutation(
    trpc.brand.rejectInvite.mutationOptions({
      onMutate: async (variables) => {
        await queryClient.cancelQueries({
          queryKey: trpc.brand.myInvites.queryKey(),
        });
        const previous = queryClient.getQueryData<MyInvites | undefined>(
          trpc.brand.myInvites.queryKey(),
        );
        queryClient.setQueryData<MyInvites | undefined>(
          trpc.brand.myInvites.queryKey(),
          (old) =>
            old
              ? {
                  data: old.data.filter((i) => i.id !== variables.id),
                }
              : old,
        );
        return { previous } as const;
      },
      onError: (_err, _vars, ctx) => {
        queryClient.setQueryData(
          trpc.brand.myInvites.queryKey(),
          ctx?.previous,
        );
      },
      onSettled: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.brand.myInvites.queryKey(),
        });
      },
    }),
  );
}
