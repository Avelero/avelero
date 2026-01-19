"use client";

import { useTRPC } from "@/trpc/client";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createClient } from "@v1/supabase/client";
import { toast } from "@v1/ui/sonner";
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

  // Mutations with optimistic updates for instant UI feedback
  const markAsSeen = useMutation(
    trpc.notifications.markAsSeen.mutationOptions({
      onMutate: async ({ id }) => {
        // Cancel outgoing refetches
        await queryClient.cancelQueries({
          queryKey: trpc.notifications.getRecent.queryKey(),
        });

        // Snapshot previous value
        const previousNotifications = queryClient.getQueryData(
          trpc.notifications.getRecent.queryKey(),
        );

        // Optimistically update the cache - mark notification as seen immediately
        queryClient.setQueryData(
          trpc.notifications.getRecent.queryKey(),
          (old: { notifications: Notification[] } | undefined) => ({
            notifications: (old?.notifications ?? []).map((n) =>
              n.id === id ? { ...n, seenAt: new Date().toISOString() } : n,
            ),
          }),
        );

        return { previousNotifications };
      },
      onError: (_err, _variables, context) => {
        // Rollback on error
        if (context?.previousNotifications) {
          queryClient.setQueryData(
            trpc.notifications.getRecent.queryKey(),
            context.previousNotifications,
          );
        }
      },
      onSettled: () => {
        // Always refetch after mutation settles to ensure consistency
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
      .on("broadcast", { event: "INSERT" }, (payload) => {
        // Show toast for import notifications
        const data = payload.payload as
          | { type?: string; title?: string }
          | undefined;
        if (data?.type === "import_success" && data.title) {
          toast.success(data.title);
        } else if (data?.type === "import_failure" && data.title) {
          toast.error(data.title);
        }

        // Invalidate queries to update UI
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
