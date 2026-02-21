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

/** tRPC router output types for type-safe hooks */
type RouterOutputs = inferRouterOutputs<AppRouter>;

/** Custom domain data returned from brand.customDomains.get */
export type CustomDomain = RouterOutputs["brand"]["customDomains"]["get"];

/** Custom domain status type - only pending and verified exist */
export type CustomDomainStatus = "pending" | "verified";

/**
 * Fetches the current brand's custom domain configuration.
 *
 * Returns the domain configuration including status, verification token,
 * and timestamps. Returns null if no domain is configured.
 *
 * This query is client-side only and disabled during SSR to prevent hydration
 * mismatches.
 *
 * @returns Query hook for brand's custom domain
 *
 * @example
 * ```tsx
 * const { data: domain, isLoading } = useCustomDomainQuery();
 *
 * if (domain) {
 *   console.log(domain.domain, domain.status);
 * }
 * ```
 */
export function useCustomDomainQuery() {
  const trpc = useTRPC();
  const opts = trpc.brand.customDomains.get.queryOptions();
  return useQuery({
    ...opts,
    enabled: typeof window !== "undefined",
  });
}

/**
 * Fetches the current brand's custom domain configuration using Suspense.
 *
 * Suspense-enabled version of useCustomDomainQuery. Use this in components
 * wrapped with Suspense boundaries for streaming SSR.
 *
 * @returns Suspense query hook for brand's custom domain
 *
 * @example
 * ```tsx
 * // Inside a Suspense boundary
 * const { data: domain } = useCustomDomainQuerySuspense();
 * ```
 */
export function useCustomDomainQuerySuspense() {
  const trpc = useTRPC();
  const opts = trpc.brand.customDomains.get.queryOptions();
  return useSuspenseQuery(opts);
}

/**
 * Adds a new custom domain for the brand.
 *
 * Creates a pending domain record with a verification token. The brand owner
 * must then add DNS records and verify ownership. Invalidates the custom domain
 * query on success.
 *
 * @returns Mutation hook for adding a custom domain
 *
 * @example
 * ```tsx
 * const addDomain = useAddCustomDomainMutation();
 *
 * const handleAddDomain = async (domain: string) => {
 *   await addDomain.mutateAsync({ domain });
 * };
 * ```
 */
export function useAddCustomDomainMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.brand.customDomains.add.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.brand.customDomains.get.queryKey(),
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.composite.initDashboard.queryKey(),
        });
      },
      onError: (error) => {
        const message =
          error.message || "Failed to add domain. Please try again.";
        toast.error(message);
      },
    }),
  );
}

/**
 * Triggers DNS verification for the brand's pending domain.
 *
 * Performs a DNS TXT record lookup to verify domain ownership. Updates the
 * domain status to 'verified' on success or 'failed' on failure. Invalidates
 * the custom domain query after the mutation.
 *
 * @returns Mutation hook for verifying a custom domain
 *
 * @example
 * ```tsx
 * const verifyDomain = useVerifyCustomDomainMutation();
 *
 * const handleVerify = async () => {
 *   const result = await verifyDomain.mutateAsync();
 *   if (result.success) {
 *     console.log("Domain verified at:", result.verifiedAt);
 *   } else {
 *     console.log("Verification failed:", result.error);
 *   }
 * };
 * ```
 */
export function useVerifyCustomDomainMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.brand.customDomains.verify.mutationOptions({
      onSuccess: async (result) => {
        // Only show toast on success - errors are shown inline in the modal
        if (result.success) {
          toast.success("Domain verified successfully!");
        }
        await queryClient.invalidateQueries({
          queryKey: trpc.brand.customDomains.get.queryKey(),
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.composite.initDashboard.queryKey(),
        });
      },
      onError: (error) => {
        // Only show toast for unexpected errors (network issues, etc.)
        // Not for DNS verification failures which are shown inline
        const message =
          error.message || "Failed to verify domain. Please try again.";
        toast.error(message);
      },
    }),
  );
}

/**
 * Removes the brand's custom domain.
 *
 * Permanently deletes the domain configuration. After removal, the domain can
 * be reclaimed by any brand. Invalidates the custom domain query on success.
 *
 * @returns Mutation hook for removing a custom domain
 *
 * @example
 * ```tsx
 * const removeDomain = useRemoveCustomDomainMutation();
 *
 * const handleRemove = async () => {
 *   await removeDomain.mutateAsync();
 * };
 * ```
 */
export function useRemoveCustomDomainMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.brand.customDomains.remove.mutationOptions({
      onSuccess: async () => {
        toast.success("Domain removed successfully.");
        await queryClient.invalidateQueries({
          queryKey: trpc.brand.customDomains.get.queryKey(),
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.composite.initDashboard.queryKey(),
        });
      },
      onError: (error) => {
        const message =
          error.message || "Failed to remove domain. Please try again.";
        toast.error(message);
      },
    }),
  );
}
