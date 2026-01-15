/**
 * Notification query functions.
 *
 * Handles CRUD operations for user notifications.
 */

import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import type { Database } from "../../client";
import { userNotifications } from "../../schema";
import type {
    CreateNotificationParams,
    NotificationQueryOptions,
    UserNotification,
} from "./types";

/** Default expiration time: 24 hours */
const DEFAULT_EXPIRES_MS = 24 * 60 * 60 * 1000;

/**
 * Creates a new notification for a user.
 */
export async function createNotification(
    db: Database,
    params: CreateNotificationParams,
): Promise<UserNotification> {
    const expiresAt = params.expiresInMs !== undefined
        ? new Date(Date.now() + params.expiresInMs).toISOString()
        : new Date(Date.now() + DEFAULT_EXPIRES_MS).toISOString();

    const results = await db
        .insert(userNotifications)
        .values({
            userId: params.userId,
            brandId: params.brandId,
            type: params.type,
            title: params.title,
            message: params.message ?? null,
            resourceType: params.resourceType ?? null,
            resourceId: params.resourceId ?? null,
            actionUrl: params.actionUrl ?? null,
            actionData: params.actionData ?? null,
            expiresAt,
        })
        .returning();

    const notification = results[0];
    if (!notification) {
        throw new Error("Failed to create notification");
    }

    return mapNotification(notification);
}

/**
 * Gets the count of unread, non-dismissed, non-expired notifications for a user.
 */
export async function getUnreadNotificationCount(
    db: Database,
    userId: string,
    brandId: string,
): Promise<number> {
    const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(userNotifications)
        .where(
            and(
                eq(userNotifications.userId, userId),
                eq(userNotifications.brandId, brandId),
                isNull(userNotifications.seenAt),
                isNull(userNotifications.dismissedAt),
                or(
                    isNull(userNotifications.expiresAt),
                    gt(userNotifications.expiresAt, new Date().toISOString()),
                ),
            ),
        );

    return result[0]?.count ?? 0;
}

/**
 * Gets recent notifications for a user.
 */
export async function getRecentNotifications(
    db: Database,
    userId: string,
    brandId: string,
    options: NotificationQueryOptions = {},
): Promise<UserNotification[]> {
    const {
        unreadOnly = false,
        includeDismissed = false,
        includeExpired = false,
        resourceType,
        resourceId,
        limit = 20,
    } = options;

    const conditions = [
        eq(userNotifications.userId, userId),
        eq(userNotifications.brandId, brandId),
    ];

    if (unreadOnly) {
        conditions.push(isNull(userNotifications.seenAt));
    }

    if (!includeDismissed) {
        conditions.push(isNull(userNotifications.dismissedAt));
    }

    if (!includeExpired) {
        conditions.push(
            or(
                isNull(userNotifications.expiresAt),
                gt(userNotifications.expiresAt, new Date().toISOString()),
            )!,
        );
    }

    if (resourceType) {
        conditions.push(eq(userNotifications.resourceType, resourceType));
    }

    if (resourceId) {
        conditions.push(eq(userNotifications.resourceId, resourceId));
    }

    const results = await db
        .select()
        .from(userNotifications)
        .where(and(...conditions))
        .orderBy(desc(userNotifications.createdAt))
        .limit(limit);

    return results.map(mapNotification);
}

/**
 * Gets a specific notification by ID.
 */
export async function getNotificationById(
    db: Database,
    id: string,
    userId: string,
): Promise<UserNotification | null> {
    const results = await db
        .select()
        .from(userNotifications)
        .where(
            and(
                eq(userNotifications.id, id),
                eq(userNotifications.userId, userId),
            ),
        )
        .limit(1);

    const notification = results[0];
    if (!notification) return null;

    return mapNotification(notification);
}

/**
 * Marks a notification as seen.
 */
export async function markNotificationAsSeen(
    db: Database,
    id: string,
    userId: string,
): Promise<void> {
    await db
        .update(userNotifications)
        .set({ seenAt: new Date().toISOString() })
        .where(
            and(
                eq(userNotifications.id, id),
                eq(userNotifications.userId, userId),
            ),
        );
}

/**
 * Marks all notifications as seen for a user in a brand.
 */
export async function markAllNotificationsAsSeen(
    db: Database,
    userId: string,
    brandId: string,
): Promise<number> {
    const result = await db
        .update(userNotifications)
        .set({ seenAt: new Date().toISOString() })
        .where(
            and(
                eq(userNotifications.userId, userId),
                eq(userNotifications.brandId, brandId),
                isNull(userNotifications.seenAt),
                isNull(userNotifications.dismissedAt),
            ),
        )
        .returning({ id: userNotifications.id });

    return result.length;
}

/**
 * Dismisses a notification.
 */
export async function dismissNotification(
    db: Database,
    id: string,
    userId: string,
): Promise<void> {
    await db
        .update(userNotifications)
        .set({ dismissedAt: new Date().toISOString() })
        .where(
            and(
                eq(userNotifications.id, id),
                eq(userNotifications.userId, userId),
            ),
        );
}

/**
 * Deletes a notification.
 */
export async function deleteNotification(
    db: Database,
    id: string,
    userId: string,
): Promise<void> {
    await db
        .delete(userNotifications)
        .where(
            and(
                eq(userNotifications.id, id),
                eq(userNotifications.userId, userId),
            ),
        );
}

/**
 * Finds a notification by resource reference.
 * Useful to check if a notification already exists for a specific job.
 */
export async function findNotificationByResource(
    db: Database,
    userId: string,
    resourceType: string,
    resourceId: string,
): Promise<UserNotification | null> {
    const results = await db
        .select()
        .from(userNotifications)
        .where(
            and(
                eq(userNotifications.userId, userId),
                eq(userNotifications.resourceType, resourceType),
                eq(userNotifications.resourceId, resourceId),
                isNull(userNotifications.dismissedAt),
            ),
        )
        .limit(1);

    const notification = results[0];
    if (!notification) return null;

    return mapNotification(notification);
}

/**
 * Cleans up expired and old dismissed notifications.
 * This should be run periodically (e.g., daily via cron).
 */
export async function cleanupExpiredNotifications(
    db: Database,
    /** Keep dismissed notifications for this many days (default: 7) */
    dismissedRetentionDays = 7,
): Promise<{ deleted: number }> {
    const cutoffDate = new Date(
        Date.now() - dismissedRetentionDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const result = await db
        .delete(userNotifications)
        .where(
            or(
                // Delete expired notifications
                and(
                    sql`${userNotifications.expiresAt} IS NOT NULL`,
                    sql`${userNotifications.expiresAt} < NOW()`,
                ),
                // Delete old dismissed notifications
                and(
                    sql`${userNotifications.dismissedAt} IS NOT NULL`,
                    sql`${userNotifications.dismissedAt} < ${cutoffDate}`,
                ),
            ),
        )
        .returning({ id: userNotifications.id });

    return { deleted: result.length };
}

/**
 * Maps a database row to a UserNotification object.
 */
function mapNotification(row: typeof userNotifications.$inferSelect): UserNotification {
    return {
        id: row.id,
        userId: row.userId,
        brandId: row.brandId,
        type: row.type,
        title: row.title,
        message: row.message,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        actionUrl: row.actionUrl,
        actionData: row.actionData as Record<string, unknown> | null,
        seenAt: row.seenAt,
        dismissedAt: row.dismissedAt,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
    };
}
