"use client";

import { useTRPC } from "@/trpc/client";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";

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
