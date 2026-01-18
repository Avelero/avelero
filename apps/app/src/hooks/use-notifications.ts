"use client";

import { useTRPC } from "@/trpc/client";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
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
 * Uses Suspense - wrap calling components in a Suspense boundary.
 * Suspends until both user and notification data are loaded.
 *
 * @example
 * ```tsx
 * // Wrap in Suspense
 * <Suspense fallback={<Skeleton />}>
 *   <NotificationContent />
 * </Suspense>
 *
 * // Inside NotificationContent
 * const { notifications, markAsSeen } = useNotifications();
 * ```
 */
export function useNotifications() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const { data: user } = useUserQuerySuspense();

  // Suspense queries - will suspend until data is available
  const unreadCountQuery = useSuspenseQuery(
    trpc.notifications.getUnreadCount.queryOptions(),
  );

  const recentNotificationsQuery = useSuspenseQuery(
    trpc.notifications.getRecent.queryOptions({
      limit: 10,
      unreadOnly: false,
      includeDismissed: false,
    }),
  );

  // Mutations
  const markAsSeen = useMutation(
    trpc.notifications.markAsSeen.mutationOptions({
      onSuccess: () => {
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
        queryClient.invalidateQueries({
          queryKey: trpc.notifications.getUnreadCount.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.notifications.getRecent.queryKey(),
        });
      },
    }),
  );

  // Subscribe to realtime notifications channel
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications:${user.id}`, { config: { private: true } })
      .on("broadcast", { event: "INSERT" }, () => {
        queryClient.invalidateQueries({
          queryKey: trpc.notifications.getUnreadCount.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.notifications.getRecent.queryKey(),
        });
      })
      .on("broadcast", { event: "UPDATE" }, () => {
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
    /** Recent notifications */
    notifications: (recentNotificationsQuery.data?.notifications ??
      []) as Notification[],
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

// Keep the old name as alias for backwards compatibility during migration
export { useNotifications as useNotificationsSuspense };
