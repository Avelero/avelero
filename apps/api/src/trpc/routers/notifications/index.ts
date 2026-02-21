/**
 * Notifications domain router.
 *
 * Implements the `notifications.*` namespace for user-specific in-app notifications.
 *
 * Endpoints:
 * - notifications.getUnreadCount - Get count of unread notifications (for badge)
 * - notifications.getRecent - Get recent notifications (for dropdown/panel)
 * - notifications.markAsSeen - Mark a specific notification as seen
 * - notifications.markAllAsSeen - Mark all notifications as seen
 * - notifications.dismiss - Dismiss a notification (hides it but keeps for analytics)
 * - notifications.delete - Permanently delete a notification
 */

import {
  deleteNotification,
  dismissNotification,
  getRecentNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsSeen,
  markNotificationsAsSeen,
  markNotificationAsSeen,
} from "@v1/db/queries/notifications";
import { logger } from "@v1/logger";
import {
  deleteNotificationSchema,
  dismissNotificationSchema,
  getRecentNotificationsSchema,
  markNotificationsAsSeenSchema,
  markNotificationAsSeenSchema,
} from "../../../schemas/notifications.js";
import { wrapError } from "../../../utils/errors.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";

export const notificationsRouter = createTRPCRouter({
  /**
   * Get count of unread notifications for the current user in the active brand.
   * Used for the notification badge.
   */
  getUnreadCount: brandRequiredProcedure.query(async ({ ctx }) => {
    try {
      const count = await getUnreadNotificationCount(
        ctx.db,
        ctx.user.id,
        ctx.brandId,
      );
      return { count };
    } catch (error) {
      throw wrapError(error, "Failed to get unread notification count");
    }
  }),

  /**
   * Get recent notifications for the current user in the active brand.
   * Returns notifications ordered by creation date (newest first).
   */
  getRecent: brandRequiredProcedure
    .input(getRecentNotificationsSchema)
    .query(async ({ ctx, input }) => {
      try {
        const notifications = await getRecentNotifications(
          ctx.db,
          ctx.user.id,
          ctx.brandId,
          {
            unreadOnly: input.unreadOnly,
            includeDismissed: input.includeDismissed,
            limit: input.limit,
          },
        );

        return {
          notifications: notifications.map((n) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            message: n.message,
            resourceType: n.resourceType,
            resourceId: n.resourceId,
            actionUrl: n.actionUrl,
            actionData: n.actionData,
            seenAt: n.seenAt,
            createdAt: n.createdAt,
          })),
        };
      } catch (error) {
        throw wrapError(error, "Failed to get recent notifications");
      }
    }),

  /**
   * Mark a specific notification as seen.
   * The notification will no longer count towards the unread badge.
   */
  markAsSeen: brandRequiredProcedure
    .input(markNotificationAsSeenSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await markNotificationAsSeen(ctx.db, input.id, ctx.user.id);

        logger.info(
          {
            userId: ctx.user.id,
            notificationId: input.id,
          },
          "Notification marked as seen",
        );

        return { success: true };
      } catch (error) {
        throw wrapError(error, "Failed to mark notification as seen");
      }
    }),

  /**
   * Mark multiple notifications as seen.
   * Used when opening the notification center.
   */
  markManyAsSeen: brandRequiredProcedure
    .input(markNotificationsAsSeenSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const count = await markNotificationsAsSeen(
          ctx.db,
          ctx.user.id,
          ctx.brandId,
          input.ids,
        );

        logger.info(
          {
            userId: ctx.user.id,
            count,
          },
          "Notifications marked as seen",
        );

        return { success: true, count };
      } catch (error) {
        throw wrapError(error, "Failed to mark notifications as seen");
      }
    }),

  /**
   * Mark all notifications as seen for the current user in the active brand.
   */
  markAllAsSeen: brandRequiredProcedure.mutation(async ({ ctx }) => {
    try {
      const count = await markAllNotificationsAsSeen(
        ctx.db,
        ctx.user.id,
        ctx.brandId,
      );

      logger.info(
        {
          userId: ctx.user.id,
          brandId: ctx.brandId,
          count,
        },
        "All notifications marked as seen",
      );

      return { success: true, count };
    } catch (error) {
      throw wrapError(error, "Failed to mark all notifications as seen");
    }
  }),

  /**
   * Dismiss a notification.
   * The notification will be hidden from the UI but kept for analytics.
   */
  dismiss: brandRequiredProcedure
    .input(dismissNotificationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await dismissNotification(ctx.db, input.id, ctx.user.id);

        logger.info(
          {
            userId: ctx.user.id,
            notificationId: input.id,
          },
          "Notification dismissed",
        );

        return { success: true };
      } catch (error) {
        throw wrapError(error, "Failed to dismiss notification");
      }
    }),

  /**
   * Permanently delete a notification.
   */
  delete: brandRequiredProcedure
    .input(deleteNotificationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteNotification(ctx.db, input.id, ctx.user.id);

        logger.info(
          {
            userId: ctx.user.id,
            notificationId: input.id,
          },
          "Notification deleted",
        );

        return { success: true };
      } catch (error) {
        throw wrapError(error, "Failed to delete notification");
      }
    }),
});

type NotificationsRouter = typeof notificationsRouter;
