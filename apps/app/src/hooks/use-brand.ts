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

/** Brand membership data returned from user.brands queries */
type BrandMembership = RouterOutputs["user"]["brands"]["list"][number];

/** User profile data shape */
type UserProfile = RouterOutputs["user"]["get"];

/** Result from leaving a brand, includes next brand ID if available */
type LeaveBrandResult = RouterOutputs["user"]["brands"]["leave"];

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
  const opts = trpc.user.brands.list.queryOptions();
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
  const opts = trpc.user.brands.list.queryOptions();
  return useSuspenseQuery({
    ...opts,
  });
}

/**
 * Switches the user's active brand context.
 *
 * On success, immediately performs a hard refresh to the home page. This ensures
 * all server-side context (tRPC context, RSC data) is regenerated with the new
 * brand without any premature data refetching.
 *
 * Flow:
 * 1. Mutation executes and updates database
 * 2. Hard refresh to home page (`window.location.href = "/"`)
 * 3. Fresh server-side context created with new brandId
 * 4. All data refetched with new brand context
 *
 * Note: Does NOT use optimistic updates to avoid triggering premature data
 * refetching before the redirect.
 *
 * @returns Mutation hook for brand switching
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

  return useMutation(
    trpc.user.brands.setActive.mutationOptions({
      onSuccess: async () => {
        // Force a hard refresh to ensure all server-side context is regenerated
        // This guarantees:
        // 1. New tRPC context is created with updated brandId from database
        // 2. All Server Components are re-rendered with fresh data
        // 3. Client-side cache is completely cleared
        // 4. No premature data refetching before redirect
        // Using window.location.href ensures a full page reload
        window.location.href = "/";
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
function useCreateBrandMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.user.brands.create.mutationOptions({
      onSuccess: async () => {
        // Invalidate brands list and user data to show new brand
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
    trpc.brand.update.mutationOptions({
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
            queryKey: trpc.user.brands.list.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.user.get.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.composite.initDashboard.queryKey(),
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
 *   await leaveBrand.mutateAsync({});
 * };
 * ```
 */
export function useLeaveBrandMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  // Prefetch pending-access route for post-leave navigation
  useEffect(() => {
    router.prefetch("/pending-access");
  }, [router]);

  return useMutation(
    trpc.user.brands.leave.mutationOptions({
      onSuccess: async (res: LeaveBrandResult, _variables) => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.user.brands.list.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.user.get.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.composite.initDashboard.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.composite.membersWithInvites.queryKey({}),
          }),
        ]);
        const nextBrandId =
          (res as { nextBrandId?: string | null } | undefined)?.nextBrandId ??
          null;
        // Redirect to pending-access when user has no brands left
        if (!nextBrandId) router.push("/pending-access");
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
    const memberships = (data ?? []) as BrandMembership[];
    return memberships.find((brand) => brand.id === brandId) ?? null;
  }, [data, brandId]);
}
