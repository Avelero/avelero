/**
 * Notification Broadcast Utility
 *
 * Sends Supabase Realtime broadcasts to user notification channels.
 * This allows the frontend to show toasts immediately without polling.
 *
 * @module notification-broadcast
 */

import { sql } from "drizzle-orm";
import type { Database } from "../client";
import type { UserNotification } from "../queries/notifications/types";

/**
 * Broadcasts a notification to the user's realtime channel.
 *
 * The frontend listens on `notifications:{userId}` channel for INSERT events.
 * This function sends a broadcast with the notification payload so the frontend
 * can immediately show a toast without waiting for query invalidation.
 *
 * @param db - Database instance with realtime.send capability
 * @param userId - ID of the user to notify
 * @param notification - The notification that was created
 */
export async function sendNotificationBroadcast(
  db: Database,
  userId: string,
  notification: UserNotification,
): Promise<void> {
  const topic = `notifications:${userId}`;
  const event = "INSERT";
  const payload = {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
  };

  await db.execute(sql`
    SELECT realtime.send(
      ${JSON.stringify(payload)}::jsonb,
      ${event}::text,
      ${topic}::text,
      true
    )
  `);
}
