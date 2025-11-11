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
import { useEffect, useMemo } from "react";

/** tRPC router output types for type-safe hooks */
type RouterOutputs = inferRouterOutputs<AppRouter>;

/** Brand membership data returned from workflow queries */
type WorkflowMembership = RouterOutputs["workflow"]["list"][number];

/** User profile data shape */
type UserProfile = RouterOutputs["user"]["get"];

/** Result from leaving a brand, includes next brand ID if available */
type LeaveBrandResult = RouterOutputs["workflow"]["members"]["update"];

/**
 * Fetches all brands the current user belongs to.
 *
 * This query is client-side only and disabled during SSR to prevent hydration
 * mismatches. The query enables users to switch between their brand memberships.
 *
 * @returns Query hook for user's brand memberships
 *
 * @example
 * ```tsx
 * const { data: brands, isLoading } = useUserBrandsQuery();
 * ```
 */
export function useUserBrandsQuery() {
  const trpc = useTRPC();
  const opts = trpc.workflow.list.queryOptions();
  return useQuery({
    ...opts,
    enabled: typeof window !== "undefined",
  });
}

/**
 * Fetches all brands the current user belongs to using Suspense.
 *
 * Suspense-enabled version of useUserBrandsQuery. Use this in components
 * wrapped with Suspense boundaries to enable streaming SSR and loading states.
 *
 * @returns Suspense query hook for user's brand memberships
 *
 * @example
 * ```tsx
 * // Inside a Suspense boundary
 * const { data: brands } = useUserBrandsQuerySuspense();
 * ```
 */
export function useUserBrandsQuerySuspense() {
  const trpc = useTRPC();
  const opts = trpc.workflow.list.queryOptions();
  return useSuspenseQuery({
    ...opts,
  });
}

/**
 * Switches the user's active brand context.
 *
 * Implements optimistic updates to immediately reflect the brand change in the UI
 * before server confirmation. On error, rolls back the optimistic update. On success,
 * invalidates all brand-scoped queries and triggers a router refresh to update
 * server-side context.
 *
 * @returns Mutation hook with optimistic update handling
 *
 * @example
 * ```tsx
 * const setActiveBrand = useSetActiveBrandMutation();
 *
 * const handleBrandSwitch = async (brandId: string) => {
 *   await setActiveBrand.mutateAsync({ brand_id: brandId });
 * };
 * ```
 */
export function useSetActiveBrandMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation(
    trpc.workflow.setActive.mutationOptions({
      onMutate: async (variables) => {
        // Cancel outgoing refetches to prevent race conditions
        await queryClient.cancelQueries({
          queryKey: trpc.user.get.queryKey(),
        });

        // Snapshot current user data for rollback
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
        // Rollback optimistic update on failure
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

/**
 * Creates a new brand and assigns the current user as owner.
 *
 * On success, invalidates all brand-related queries to reflect the new brand
 * in the UI. The newly created brand becomes the user's active brand automatically.
 *
 * @returns Mutation hook for brand creation
 *
 * @example
 * ```tsx
 * const createBrand = useCreateBrandMutation();
 *
 * const handleCreateBrand = async () => {
 *   await createBrand.mutateAsync({
 *     name: "Acme Corp",
 *     email: "contact@acme.com"
 *   });
 * };
 * ```
 */
export function useCreateBrandMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.workflow.create.mutationOptions({
      onSuccess: async () => {
        // Invalidate brands list and user data to show new brand
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

/**
 * Updates brand profile information (name, logo, email, country).
 *
 * Implements lightweight optimistic updates by canceling in-flight queries
 * and snapshotting user data for rollback. Invalidates all brand-related
 * queries after the mutation settles (success or failure).
 *
 * @returns Mutation hook for updating brand profile
 *
 * @example
 * ```tsx
 * const updateBrand = useBrandUpdateMutation();
 *
 * const handleUpdateBrand = async () => {
 *   await updateBrand.mutateAsync({
 *     brand_id: brandId,
 *     name: "New Brand Name"
 *   });
 * };
 * ```
 */
export function useBrandUpdateMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.workflow.update.mutationOptions({
      onMutate: async (variables) => {
        await queryClient.cancelQueries();
        const prevUser = queryClient.getQueryData(trpc.user.get.queryKey());
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

/**
 * Removes the current user from a brand membership.
 *
 * On success, invalidates all brand-related queries and redirects the user
 * to brand creation if they have no remaining brands. Otherwise, switches
 * to the next available brand (alphabetically).
 *
 * Note: Sole owners cannot leave their brand - they must promote another
 * member to owner first or delete the brand.
 *
 * @returns Mutation hook for leaving a brand
 *
 * @example
 * ```tsx
 * const leaveBrand = useLeaveBrandMutation();
 *
 * const handleLeaveBrand = async () => {
 *   await leaveBrand.mutateAsync({ brand_id: brandId });
 * };
 * ```
 */
export function useLeaveBrandMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  // Prefetch create-brand route for post-leave navigation
  useEffect(() => {
    router.prefetch("/create-brand");
  }, [router]);

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
        // Redirect to brand creation when user has no brands left
        if (!nextBrandId) router.push("/create-brand");
        router.refresh();
      },
    }),
  );
}

/**
 * Finds a specific brand from the user's memberships by ID.
 *
 * Efficiently looks up a brand membership from the cached workflow list.
 * Returns null if the brand ID is not provided or the user is not a member.
 *
 * @param brandId - Brand ID to look up
 * @returns Brand membership data or null if not found
 *
 * @example
 * ```tsx
 * const brand = useWorkflowBrandById(brandId);
 *
 * if (brand) {
 *   console.log(brand.name, brand.role);
 * }
 * ```
 */
export function useWorkflowBrandById(brandId: string | null | undefined) {
  const { data } = useUserBrandsQuery();
  return useMemo(() => {
    if (!brandId) return null;
    const memberships = (data ?? []) as WorkflowMembership[];
    return memberships.find((brand) => brand.id === brandId) ?? null;
  }, [data, brandId]);
}
