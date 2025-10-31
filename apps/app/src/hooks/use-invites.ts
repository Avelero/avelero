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
  const opts = trpc.v2.user.invites.list.queryOptions();
  return useQuery(opts);
}

export function useMyInvitesQuerySuspense() {
  const trpc = useTRPC();
  const opts = trpc.v2.user.invites.list.queryOptions();
  return useSuspenseQuery(opts);
}

export function useAcceptInviteMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  type RouterOutputs = inferRouterOutputs<AppRouter>;
  type MyInvites = RouterOutputs["v2"]["user"]["invites"]["list"];
  return useMutation(
    trpc.brand.acceptInvite.mutationOptions({
      onMutate: async (variables) => {
        await queryClient.cancelQueries({
          queryKey: trpc.v2.user.invites.list.queryKey(),
        });
        const previous = queryClient.getQueryData<MyInvites | undefined>(
          trpc.v2.user.invites.list.queryKey(),
        );

        // Find the invite to get brand name for toast
        const invite = previous?.find((i) => i.id === variables.id);
        const brandName = invite?.brand_name || "brand";

        queryClient.setQueryData<MyInvites | undefined>(
          trpc.v2.user.invites.list.queryKey(),
          (old) =>
            old
              ? old.filter((i) => i.id !== variables.id)
              : old,
        );

        return { previous, brandName } as const;
      },
      onError: (_err, _vars, ctx) => {
        queryClient.setQueryData(
          trpc.v2.user.invites.list.queryKey(),
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
          queryKey: trpc.v2.user.invites.list.queryKey(),
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.brand.list.queryKey(),
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.v2.user.get.queryKey(),
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.brand.members.queryKey(),
        });
      },
    }),
  );
}

export function useRejectInviteMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  type RouterOutputs = inferRouterOutputs<AppRouter>;
  type MyInvites = RouterOutputs["v2"]["user"]["invites"]["list"];
  return useMutation(
    trpc.brand.rejectInvite.mutationOptions({
      onMutate: async (variables) => {
        await queryClient.cancelQueries({
          queryKey: trpc.v2.user.invites.list.queryKey(),
        });
        const previous = queryClient.getQueryData<MyInvites | undefined>(
          trpc.v2.user.invites.list.queryKey(),
        );
        queryClient.setQueryData<MyInvites | undefined>(
          trpc.v2.user.invites.list.queryKey(),
          (old) =>
            old
              ? old.filter((i) => i.id !== variables.id)
              : old,
        );
        return { previous } as const;
      },
      onError: (_err, _vars, ctx) => {
        queryClient.setQueryData(
          trpc.v2.user.invites.list.queryKey(),
          ctx?.previous,
        );
      },
      onSettled: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.v2.user.invites.list.queryKey(),
        });
      },
    }),
  );
}
