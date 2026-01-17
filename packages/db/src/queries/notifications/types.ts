/**
 * Notification types for the notification system.
 */

/**
 * Known notification types
 */
export type NotificationType =
  | "import_failure"
  | "export_ready"
  | "sync_complete"
  | "sync_failure";

/**
 * Known resource types for polymorphic references
 */
export type NotificationResourceType = "import_job" | "export_job" | "sync_job";

/**
 * User notification record from the database
 */
export interface UserNotification {
  id: string;
  userId: string;
  brandId: string;
  type: NotificationType | string;
  title: string;
  message: string | null;
  resourceType: NotificationResourceType | string | null;
  resourceId: string | null;
  actionUrl: string | null;
  actionData: Record<string, unknown> | null;
  seenAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

/**
 * Parameters for creating a notification
 */
export interface CreateNotificationParams {
  userId: string;
  brandId: string;
  type: NotificationType | string;
  title: string;
  message?: string | null;
  resourceType?: NotificationResourceType | string | null;
  resourceId?: string | null;
  actionUrl?: string | null;
  actionData?: Record<string, unknown> | null;
  /** TTL in milliseconds from now (defaults to 24 hours) */
  expiresInMs?: number;
}

/**
 * Filter options for querying notifications
 */
export interface NotificationQueryOptions {
  /** Only return unread notifications (seenAt IS NULL) */
  unreadOnly?: boolean;
  /** Include dismissed notifications (default: false) */
  includeDismissed?: boolean;
  /** Include expired notifications (default: false) */
  includeExpired?: boolean;
  /** Filter by resource type */
  resourceType?: NotificationResourceType | string;
  /** Filter by resource ID */
  resourceId?: string;
  /** Limit number of results */
  limit?: number;
}
