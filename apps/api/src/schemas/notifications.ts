/**
 * Notification API schemas for validation.
 */
import { z } from "zod";

/**
 * Get recent notifications query options
 */
export const getRecentNotificationsSchema = z.object({
  /** Maximum number of notifications to return */
  limit: z.number().int().min(1).max(100).default(20),
  /** Only return unread notifications */
  unreadOnly: z.boolean().default(false),
  /** Include dismissed notifications */
  includeDismissed: z.boolean().default(false),
});

/**
 * Mark notification as seen
 */
export const markNotificationAsSeenSchema = z.object({
  /** Notification ID to mark as seen */
  id: z.string().uuid(),
});

/**
 * Mark multiple notifications as seen.
 */
export const markNotificationsAsSeenSchema = z.object({
  /** Notification IDs to mark as seen */
  ids: z.array(z.string().uuid()).min(1).max(100),
});

/**
 * Dismiss notification
 */
export const dismissNotificationSchema = z.object({
  /** Notification ID to dismiss */
  id: z.string().uuid(),
});

/**
 * Delete notification
 */
export const deleteNotificationSchema = z.object({
  /** Notification ID to delete */
  id: z.string().uuid(),
});
