"use client";

import { useTRPC } from "@/trpc/client";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function useUserBrandsQuery() {
  const trpc = useTRPC();
  const opts = trpc.brand.list.queryOptions();
  return useQuery({ ...(opts as any), enabled: typeof window !== "undefined" } as any);
}

export function useUserBrandsQuerySuspense() {
  const trpc = useTRPC();
  const opts = trpc.brand.list.queryOptions();
  return useSuspenseQuery({ ...(opts as any), enabled: typeof window !== "undefined" } as any);
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
          queryKey: trpc.user.me.queryKey(),
        });

        // Get current user data
        const previousUserData = queryClient.getQueryData(trpc.user.me.queryKey());

        // Optimistically update user's active brand
        queryClient.setQueryData(trpc.user.me.queryKey(), (old: any) => ({
          ...old,
          brand_id: variables.id,
        }));

        return { previousUserData };
      },
      onError: (_, __, context) => {
        // Rollback on error
        queryClient.setQueryData(
          trpc.user.me.queryKey(),
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
          queryKey: trpc.user.me.queryKey(),
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
        const prevUser = queryClient.getQueryData(trpc.user.me.queryKey());
        // best-effort optimistic touch: nothing heavy here
        return { prevUser };
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.prevUser) {
          queryClient.setQueryData(trpc.user.me.queryKey(), ctx.prevUser);
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
  const opts = trpc.brand.canLeave.queryOptions({ id: brandId as string } as any);
  return useQuery({
    ...(opts as any),
    enabled: Boolean(brandId) && typeof window !== "undefined",
  } as any);
}

export function useLeaveBrandMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation(
    trpc.brand.leave.mutationOptions({
      onSuccess: async (res: any) => {
        await queryClient.invalidateQueries();
        // Only redirect when user has no brands left
        if (!res?.nextBrandId) router.push("/brands/create");
        router.refresh();
      },
    }) as any,
  );
}

export function usePrefetchCanLeaveForBrands(brandIds: string[]) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!brandIds?.length) return;
    for (const id of brandIds) {
      const opts = trpc.brand.canLeave.queryOptions({ id } as any);
      queryClient.prefetchQuery(opts as any);
    }
  }, [brandIds, trpc, queryClient]);
}