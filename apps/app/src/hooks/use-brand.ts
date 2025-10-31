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
import { useEffect } from "react";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type Me = RouterOutputs["v2"]["user"]["get"];
type LeaveBrandResult = RouterOutputs["brand"]["leave"];

export function useUserBrandsQuery() {
  const trpc = useTRPC();
  const opts = trpc.brand.list.queryOptions();
  return useQuery({
    ...opts,
    enabled: typeof window !== "undefined",
  });
}

export function useUserBrandsQuerySuspense() {
  const trpc = useTRPC();
  const opts = trpc.brand.list.queryOptions();
  return useSuspenseQuery({
    ...opts,
  });
}

export function useSetActiveBrandMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation(
    trpc.brand.setActive.mutationOptions({
      onMutate: async (variables) => {
        // Cancel outgoing refetches
        await queryClient.cancelQueries({
          queryKey: trpc.v2.user.get.queryKey(),
        });

        // Get current user data
        const previousUserData = queryClient.getQueryData<Me>(
          trpc.v2.user.get.queryKey(),
        );

        // Optimistically update user's active brand
        queryClient.setQueryData<Me | undefined>(
          trpc.v2.user.get.queryKey(),
          (old: Me | undefined) =>
            old ? { ...old, brand_id: variables.id } : old,
        );

        return { previousUserData };
      },
      onError: (_, __, context) => {
        // Rollback on error
        queryClient.setQueryData(
          trpc.v2.user.get.queryKey(),
          context?.previousUserData,
        );
      },
      onSuccess: async () => {
        // Invalidate all queries to refresh with new brand context
        await queryClient.invalidateQueries();
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
    trpc.brand.create.mutationOptions({
      onSuccess: async () => {
        // Invalidate brands list and user data
        await queryClient.invalidateQueries({
          queryKey: trpc.brand.list.queryKey(),
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.v2.user.get.queryKey(),
        });
      },
    }),
  );
}

export function useBrandUpdateMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.brand.update.mutationOptions({
      onMutate: async (variables) => {
        await queryClient.cancelQueries();
        const prevUser = queryClient.getQueryData(trpc.v2.user.get.queryKey());
        // best-effort optimistic touch: nothing heavy here
        return { prevUser };
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.prevUser) {
          queryClient.setQueryData(trpc.v2.user.get.queryKey(), ctx.prevUser);
        }
      },
      onSettled: async () => {
        await queryClient.invalidateQueries(); // refresh brand and user reads
      },
    }),
  );
}

export function useCanLeaveBrandQuery(brandId: string | null | undefined) {
  const trpc = useTRPC();
  const opts = trpc.brand.canLeave.queryOptions({
    id: brandId as string,
  });
  return useQuery({
    ...opts,
    enabled: Boolean(brandId) && typeof window !== "undefined",
  });
}

export function useLeaveBrandMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation(
    trpc.brand.leave.mutationOptions({
      onSuccess: async (res: LeaveBrandResult) => {
        await queryClient.invalidateQueries();
        // Only redirect when user has no brands left
        if (!res?.nextBrandId) router.push("/create-brand");
        router.refresh();
      },
    }),
  );
}

export function usePrefetchCanLeaveForBrands(brandIds: string[]) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!brandIds?.length) return;
    for (const id of brandIds) {
      const opts = trpc.brand.canLeave.queryOptions({ id });
      queryClient.prefetchQuery(opts);
    }
  }, [brandIds, trpc, queryClient]);
}
