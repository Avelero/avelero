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
import { useRouter } from "next/navigation";
import { useMemo } from "react";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type WorkflowMembership = RouterOutputs["workflow"]["list"][number];
type UserProfile = RouterOutputs["user"]["get"];
type LeaveBrandResult = RouterOutputs["workflow"]["members"]["update"];

export function useUserBrandsQuery() {
  const trpc = useTRPC();
  const opts = trpc.workflow.list.queryOptions();
  return useQuery({
    ...opts,
    enabled: typeof window !== "undefined",
  });
}

export function useUserBrandsQuerySuspense() {
  const trpc = useTRPC();
  const opts = trpc.workflow.list.queryOptions();
  return useSuspenseQuery({
    ...opts,
  });
}

export function useSetActiveBrandMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation(
    trpc.workflow.setActive.mutationOptions({
      onMutate: async (variables) => {
        // Cancel outgoing refetches
        await queryClient.cancelQueries({
          queryKey: trpc.user.get.queryKey(),
        });

        // Get current user data
        const previousUserData = queryClient.getQueryData<UserProfile>(
          trpc.user.get.queryKey(),
        );

        // Optimistically update user's active brand
        queryClient.setQueryData<UserProfile | undefined>(
          trpc.user.get.queryKey(),
          (old: UserProfile | undefined) =>
            old ? { ...old, brand_id: variables.brand_id } : old,
        );

        return { previousUserData };
      },
      onError: (_, __, context) => {
        // Rollback on error
        queryClient.setQueryData(
          trpc.user.get.queryKey(),
          context?.previousUserData,
        );
      },
      onSuccess: async () => {
        // Invalidate all queries to refresh with new brand context
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.workflow.list.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.user.get.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.composite.workflowInit.queryKey(),
          }),
        ]);
        // Refresh the page to update server-side brand context
        router.refresh();
      },
    }),
  );
}

export function useCreateBrandMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.workflow.create.mutationOptions({
      onSuccess: async () => {
        // Invalidate brands list and user data
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

export function useBrandUpdateMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.workflow.update.mutationOptions({
      onMutate: async (variables) => {
        await queryClient.cancelQueries();
        const prevUser = queryClient.getQueryData(trpc.user.get.queryKey());
        // best-effort optimistic touch: nothing heavy here
        return { prevUser };
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.prevUser) {
          queryClient.setQueryData(trpc.user.get.queryKey(), ctx.prevUser);
        }
      },
      onSettled: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.workflow.list.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.user.get.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.composite.workflowInit.queryKey(),
          }),
        ]);
      },
    }),
  );
}

export function useLeaveBrandMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation(
    trpc.workflow.members.update.mutationOptions({
      onSuccess: async (
        res: LeaveBrandResult,
        variables: { brand_id: string },
      ) => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.workflow.list.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.user.get.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.composite.workflowInit.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.composite.membersWithInvites.queryKey({
              brand_id: variables.brand_id,
            }),
          }),
        ]);
        const nextBrandId =
          (res as { nextBrandId?: string | null } | undefined)?.nextBrandId ??
          null;
        // Only redirect when user has no brands left
        if (!nextBrandId) router.push("/create-brand");
        router.refresh();
      },
    }),
  );
}

export function useWorkflowBrandById(brandId: string | null | undefined) {
  const { data } = useUserBrandsQuery();
  return useMemo(() => {
    if (!brandId) return null;
    const memberships = (data ?? []) as WorkflowMembership[];
    return memberships.find((brand) => brand.id === brandId) ?? null;
  }, [data, brandId]);
}
