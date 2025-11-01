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
  const opts = trpc.user.invites.list.queryOptions();
  return useQuery(opts);
}

export function useMyInvitesQuerySuspense() {
  const trpc = useTRPC();
  const opts = trpc.user.invites.list.queryOptions();
  return useSuspenseQuery(opts);
}

export function useAcceptInviteMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  type RouterOutputs = inferRouterOutputs<AppRouter>;
  type MyInvites = RouterOutputs["user"]["invites"]["list"];
  return useMutation(
    trpc.workflow.invites.respond.mutationOptions({
      onMutate: async (variables) => {
        await queryClient.cancelQueries({
          queryKey: trpc.user.invites.list.queryKey(),
        });
        const previous = queryClient.getQueryData<MyInvites | undefined>(
          trpc.user.invites.list.queryKey(),
        );

        // Find the invite to get brand name for toast
        const invite = previous?.find((i) => i.id === variables.invite_id);
        const brandName = invite?.brand_name || "brand";

        queryClient.setQueryData<MyInvites | undefined>(
          trpc.user.invites.list.queryKey(),
          (old) =>
            old
              ? old.filter((i) => i.id !== variables.invite_id)
              : old,
        );

        return {
          previous,
          brandName,
          inviteId: variables.invite_id,
        } as const;
      },
      onError: (_err, _vars, ctx) => {
        queryClient.setQueryData(
          trpc.user.invites.list.queryKey(),
          ctx?.previous,
        );
        toast.error("Action failed, please try again");
      },
      onSuccess: (data, _vars, ctx) => {
        const brandName = ctx?.brandName || "brand";
        toast.success(`Accepted invite from ${brandName}`);
        const brandId = (data as { brandId?: string | null } | undefined)
          ?.brandId;
        if (brandId) {
          void queryClient.invalidateQueries({
            queryKey: trpc.workflow.members.list.queryKey({
              brand_id: brandId,
            }),
          });
          void queryClient.invalidateQueries({
            queryKey: trpc.composite.membersWithInvites.queryKey({
              brand_id: brandId,
            }),
          });
        }
      },
      onSettled: async () => {
        // refresh invite inbox and memberships
        await queryClient.invalidateQueries({
          queryKey: trpc.user.invites.list.queryKey(),
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.workflow.list.queryKey(),
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.user.get.queryKey(),
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.composite.workflowInit.queryKey(),
        });
      },
    }),
  );
}

export function useRejectInviteMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  type RouterOutputs = inferRouterOutputs<AppRouter>;
  type MyInvites = RouterOutputs["user"]["invites"]["list"];
  return useMutation(
    trpc.workflow.invites.respond.mutationOptions({
      onMutate: async (variables) => {
        await queryClient.cancelQueries({
          queryKey: trpc.user.invites.list.queryKey(),
        });
        const previous = queryClient.getQueryData<MyInvites | undefined>(
          trpc.user.invites.list.queryKey(),
        );
        queryClient.setQueryData<MyInvites | undefined>(
          trpc.user.invites.list.queryKey(),
          (old) =>
            old
              ? old.filter((i) => i.id !== variables.invite_id)
              : old,
        );
        return { previous } as const;
      },
      onError: (_err, _vars, ctx) => {
        queryClient.setQueryData(
          trpc.user.invites.list.queryKey(),
          ctx?.previous,
        );
      },
      onSettled: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.user.invites.list.queryKey(),
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.composite.workflowInit.queryKey(),
        });
      },
    }),
  );
}
