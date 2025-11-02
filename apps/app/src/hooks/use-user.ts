"use client";

import { useTRPC } from "@/trpc/client";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";

/**
 * Fetches the current user's profile using Suspense.
 *
 * Returns the authenticated user's profile data including email, name,
 * avatar, and active brand ID. This query suspends rendering until data
 * is available.
 *
 * @returns Suspense query hook for current user profile
 *
 * @note API Breaking Change: This uses the `user.get` endpoint (formerly `user.me`).
 * The endpoint was renamed from `user.me` to `user.get` to follow REST-like conventions.
 * While `me` is a common pattern for 'current user' endpoints, `get` provides better
 * consistency with other entity endpoints in the API.
 *
 * @example
 * ```tsx
 * const { data: user } = useUserQuery();
 * ```
 */
export function useUserQuery() {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.user.get.queryOptions());
}

/**
 * Current user profile shape.
 */
export interface CurrentUser {
  /** Unique user identifier */
  id: string;
  /** User's email address */
  email: string;
  /** User's display name (optional) */
  full_name: string | null;
  /** Avatar image URL or path (optional) */
  avatar_url: string | null;
  /** Currently active brand ID (optional) */
  brand_id: string | null;
}

/**
 * Fetches the current user's profile using Suspense.
 *
 * Alias for useUserQuery with explicit Suspense naming. Use this in components
 * wrapped with Suspense boundaries.
 *
 * @returns Suspense query hook for current user profile
 *
 * @example
 * ```tsx
 * const { data: user } = useUserQuerySuspense();
 * ```
 */
export function useUserQuerySuspense() {
  const trpc = useTRPC();
  const opts = trpc.user.get.queryOptions();
  return useSuspenseQuery({
    ...opts,
  });
}

/**
 * Updates the current user's profile fields (name, email, avatar).
 *
 * Implements optimistic updates to immediately reflect changes in the UI
 * before server confirmation. On error, rolls back the optimistic update.
 * On success or error, invalidates the user query to ensure fresh data.
 *
 * @returns Mutation hook for updating user profile
 *
 * @example
 * ```tsx
 * const updateUser = useUserMutation();
 *
 * const handleUpdateName = async () => {
 *   await updateUser.mutateAsync({
 *     full_name: "New Name"
 *   });
 * };
 * ```
 */
export function useUserMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.user.update.mutationOptions({
      onMutate: async (newData) => {
        // Cancel outgoing refetches to prevent race conditions
        await queryClient.cancelQueries({
          queryKey: trpc.user.get.queryKey(),
        });

        // Snapshot current data for rollback
        const previousData = queryClient.getQueryData(trpc.user.get.queryKey());

        // Optimistically apply the update
        queryClient.setQueryData(trpc.user.get.queryKey(), (old) => {
          const prev = old as CurrentUser | null | undefined;
          const patch = newData as Partial<CurrentUser>;
          return prev
            ? { ...prev, ...patch }
            : ((patch as unknown as CurrentUser) ?? null);
        });

        return { previousData } as const;
      },
      onError: (_err, _vars, context) => {
        // Rollback optimistic update on failure
        const previous = (
          context as { previousData: CurrentUser | null } | undefined
        )?.previousData;
        queryClient.setQueryData(trpc.user.get.queryKey(), previous);
      },
      onSettled: () => {
        // Refetch to ensure data consistency after mutation
        queryClient.invalidateQueries({
          queryKey: trpc.user.get.queryKey(),
        });
      },
    }),
  );
}
