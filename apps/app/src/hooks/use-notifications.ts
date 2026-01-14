"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@v1/supabase/client";
import { useEffect, useMemo } from "react";
import { useUserQuerySuspense } from "./use-user";

/**
 * Notification object shape from the API.
 */
export interface Notification {
    /** Unique notification ID */
    id: string;
    /** Notification type (e.g., 'import_failure', 'export_ready') */
    type: string;
    /** Notification title */
    title: string;
    /** Optional detailed message */
    message: string | null;
    /** Type of resource this notification relates to */
    resourceType: string | null;
    /** ID of the related resource */
    resourceId: string | null;
    /** URL for click-through action */
    actionUrl: string | null;
    /** Additional action data */
    actionData: Record<string, unknown> | null;
    /** When the notification was seen (null = unread) */
    seenAt: string | null;
    /** When the notification was created */
    createdAt: string;
}

/**
 * Hook for fetching and managing notifications.
 *
 * Features:
 * - Fetches unread notification count for the badge
 * - Subscribes to realtime notifications channel for instant updates
 * - Provides mutations for marking as seen and dismissing
 *
 * @example
 * ```tsx
 * const { unreadCount, notifications, markAsSeen, markAllAsSeen, dismiss } = useNotifications();
 *
 * // Show badge
 * {unreadCount > 0 && <Badge count={unreadCount} />}
 *
 * // Mark single notification as seen
 * markAsSeen.mutate({ id: notification.id });
 *
 * // Mark all as seen
 * markAllAsSeen.mutate();
 * ```
 */
export function useNotifications() {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const supabase = useMemo(() => createClient(), []);
    const { data: user } = useUserQuerySuspense();

    // Query for unread count (for badge)
    const unreadCountQuery = useQuery({
        ...trpc.notifications.getUnreadCount.queryOptions(),
        enabled: !!user?.id && !!user?.brand_id,
        staleTime: 30_000, // Cache for 30 seconds
        refetchOnWindowFocus: true,
    });

    // Query for recent notifications (for panel/dropdown)
    const recentNotificationsQuery = useQuery({
        ...trpc.notifications.getRecent.queryOptions({
            limit: 10,
            unreadOnly: false,
            includeDismissed: false,
        }),
        enabled: !!user?.id && !!user?.brand_id,
        staleTime: 30_000,
    });

    // Mutations
    const markAsSeen = useMutation(
        trpc.notifications.markAsSeen.mutationOptions({
            onSuccess: () => {
                // Invalidate both queries
                queryClient.invalidateQueries({
                    queryKey: trpc.notifications.getUnreadCount.queryKey(),
                });
                queryClient.invalidateQueries({
                    queryKey: trpc.notifications.getRecent.queryKey(),
                });
            },
        }),
    );

    const markAllAsSeen = useMutation(
        trpc.notifications.markAllAsSeen.mutationOptions({
            onSuccess: () => {
                // Invalidate both queries
                queryClient.invalidateQueries({
                    queryKey: trpc.notifications.getUnreadCount.queryKey(),
                });
                queryClient.invalidateQueries({
                    queryKey: trpc.notifications.getRecent.queryKey(),
                });
            },
        }),
    );

    const dismiss = useMutation(
        trpc.notifications.dismiss.mutationOptions({
            onSuccess: () => {
                // Invalidate both queries
                queryClient.invalidateQueries({
                    queryKey: trpc.notifications.getUnreadCount.queryKey(),
                });
                queryClient.invalidateQueries({
                    queryKey: trpc.notifications.getRecent.queryKey(),
                });
            },
        }),
    );

    // Subscribe to realtime notifications channel (user-specific)
    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase
            .channel(`notifications:${user.id}`, { config: { private: true } })
            .on("broadcast", { event: "INSERT" }, () => {
                // New notification received - invalidate queries
                queryClient.invalidateQueries({
                    queryKey: trpc.notifications.getUnreadCount.queryKey(),
                });
                queryClient.invalidateQueries({
                    queryKey: trpc.notifications.getRecent.queryKey(),
                });
            })
            .on("broadcast", { event: "UPDATE" }, () => {
                // Notification updated (e.g., marked as seen from another device)
                queryClient.invalidateQueries({
                    queryKey: trpc.notifications.getUnreadCount.queryKey(),
                });
                queryClient.invalidateQueries({
                    queryKey: trpc.notifications.getRecent.queryKey(),
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, supabase, queryClient, trpc]);

    return {
        /** Number of unread notifications (for badge) */
        unreadCount: unreadCountQuery.data?.count ?? 0,
        /** Whether the unread count is loading */
        isLoadingCount: unreadCountQuery.isLoading,
        /** Recent notifications */
        notifications: (recentNotificationsQuery.data?.notifications ?? []) as Notification[],
        /** Whether recent notifications are loading */
        isLoadingNotifications: recentNotificationsQuery.isLoading,
        /** Refetch notifications */
        refetch: () => {
            unreadCountQuery.refetch();
            recentNotificationsQuery.refetch();
        },
        /** Mark a specific notification as seen */
        markAsSeen,
        /** Mark all notifications as seen */
        markAllAsSeen,
        /** Dismiss a notification */
        dismiss,
    };
}

/**
 * Hook for just the unread notification count.
 *
 * Lighter-weight hook for components that only need the badge count.
 * Includes realtime subscription for instant updates.
 *
 * @example
 * ```tsx
 * const { count, isLoading } = useNotificationCount();
 * ```
 */
export function useNotificationCount() {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const supabase = useMemo(() => createClient(), []);
    const { data: user } = useUserQuerySuspense();

    const query = useQuery({
        ...trpc.notifications.getUnreadCount.queryOptions(),
        enabled: !!user?.id && !!user?.brand_id,
        staleTime: 30_000,
        refetchOnWindowFocus: true,
    });

    // Subscribe to realtime for count updates
    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase
            .channel(`notifications:${user.id}`, { config: { private: true } })
            .on("broadcast", { event: "INSERT" }, () => {
                queryClient.invalidateQueries({
                    queryKey: trpc.notifications.getUnreadCount.queryKey(),
                });
            })
            .on("broadcast", { event: "UPDATE" }, () => {
                queryClient.invalidateQueries({
                    queryKey: trpc.notifications.getUnreadCount.queryKey(),
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, supabase, queryClient, trpc]);

    return {
        count: query.data?.count ?? 0,
        isLoading: query.isLoading,
        refetch: query.refetch,
    };
}
