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

/**
 * Fetches pending brand invitations for the current user.
 *
 * Returns all invites sent to the user's email address that haven't been
 * accepted or rejected. Users can view these invites and choose to accept
 * or decline membership.
 *
 * @returns Query hook for user's pending invites
 *
 * @example
 * ```tsx
 * const { data: invites, isLoading } = useMyInvitesQuery();
 * ```
 */
function useMyInvitesQuery() {
  const trpc = useTRPC();
  const opts = trpc.user.invites.list.queryOptions();
  return useQuery(opts);
}

/**
 * Fetches pending brand invitations using Suspense.
 *
 * Suspense-enabled version of useMyInvitesQuery. Use this in components
 * wrapped with Suspense boundaries for streaming SSR.
 *
 * @returns Suspense query hook for user's pending invites
 *
 * @example
 * ```tsx
 * // Inside a Suspense boundary
 * const { data: invites } = useMyInvitesQuerySuspense();
 * ```
 */
export function useMyInvitesQuerySuspense() {
  const trpc = useTRPC();
  const opts = trpc.user.invites.list.queryOptions();
  return useSuspenseQuery(opts);
}

/**
 * Accepts a brand invitation and adds the user as a member.
 *
 * Implements optimistic updates to immediately remove the invite from the UI
 * before server confirmation. On success, shows a toast notification,
 * automatically sets the new brand as active (triggering a full page refresh),
 * and invalidates all brand-related queries to reflect the new membership.
 * On error, rolls back the optimistic update and shows an error toast.
 *
 * @param options.setActiveBrand - Mutation function from useSetActiveBrandMutation to trigger brand switch
 * @returns Mutation hook for accepting brand invites
 *
 * @example
 * ```tsx
 * const setActiveBrand = useSetActiveBrandMutation();
 * const acceptInvite = useAcceptInviteMutation({ setActiveBrand: setActiveBrand.mutate });
 *
 * const handleAccept = async (inviteId: string) => {
 *   acceptInvite.mutate({
 *     invite_id: inviteId,
 *     action: "accept"
 *   });
 * };
 * ```
 */
export function useAcceptInviteMutation(opts?: {
  setActiveBrand?: (variables: { brand_id: string }) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  type RouterOutputs = inferRouterOutputs<AppRouter>;
  type MyInvites = RouterOutputs["user"]["invites"]["list"];
  return useMutation(
    trpc.user.invites.accept.mutationOptions({
      onMutate: async (variables) => {
        await queryClient.cancelQueries({
          queryKey: trpc.user.invites.list.queryKey(),
        });
        const previous = queryClient.getQueryData<MyInvites | undefined>(
          trpc.user.invites.list.queryKey(),
        );

        // Extract brand name for success toast
        const invite = previous?.find((i) => i.id === variables.invite_id);
        const brandName = invite?.brand_name || "brand";

        // Optimistically remove the invite from the list
        queryClient.setQueryData<MyInvites | undefined>(
          trpc.user.invites.list.queryKey(),
          (old) =>
            old ? old.filter((i) => i.id !== variables.invite_id) : old,
        );

        return {
          previous,
          brandName,
          inviteId: variables.invite_id,
        } as const;
      },
      onError: (_err, _vars, ctx) => {
        // Rollback optimistic update
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

        // Automatically set the new brand as active, triggering a full page refresh
        if (brandId && opts?.setActiveBrand) {
          opts.setActiveBrand({ brand_id: brandId });
        }

        // Invalidate brand-specific queries (uses active brand from context)
        void queryClient.invalidateQueries({
          queryKey: trpc.brand.members.list.queryKey({}),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.composite.membersWithInvites.queryKey({}),
        });
      },
      onSettled: async () => {
        // Refresh invite inbox and memberships
        await queryClient.invalidateQueries({
          queryKey: trpc.user.invites.list.queryKey(),
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.user.brands.list.queryKey(),
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.user.get.queryKey(),
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.composite.initDashboard.queryKey(),
        });
      },
    }),
  );
}

/**
 * Rejects a brand invitation without joining.
 *
 * Implements optimistic updates to immediately remove the invite from the UI
 * before server confirmation. On error, rolls back the optimistic update.
 * No success toast is shown for rejections.
 *
 * @returns Mutation hook for rejecting brand invites
 *
 * @example
 * ```tsx
 * const rejectInvite = useRejectInviteMutation();
 *
 * const handleReject = async (inviteId: string) => {
 *   await rejectInvite.mutateAsync({
 *     invite_id: inviteId,
 *     action: "reject"
 *   });
 * };
 * ```
 */
export function useRejectInviteMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  type RouterOutputs = inferRouterOutputs<AppRouter>;
  type MyInvites = RouterOutputs["user"]["invites"]["list"];
  return useMutation(
    trpc.user.invites.reject.mutationOptions({
      onMutate: async (variables) => {
        await queryClient.cancelQueries({
          queryKey: trpc.user.invites.list.queryKey(),
        });
        const previous = queryClient.getQueryData<MyInvites | undefined>(
          trpc.user.invites.list.queryKey(),
        );
        // Optimistically remove the invite from the list
        queryClient.setQueryData<MyInvites | undefined>(
          trpc.user.invites.list.queryKey(),
          (old) =>
            old ? old.filter((i) => i.id !== variables.invite_id) : old,
        );
        return { previous } as const;
      },
      onError: (_err, _vars, ctx) => {
        // Rollback optimistic update
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
          queryKey: trpc.composite.initDashboard.queryKey(),
        });
      },
    }),
  );
}
