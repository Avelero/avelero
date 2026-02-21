/**
 * Notification types for the notification system.
 */

/**
 * Known notification types
 */
export type NotificationType =
  | "import_success"
  | "import_failure"
  | "export_ready"
  | "qr_export_ready"
  | "invite_accepted"
  | "sync_complete"
  | "sync_failure";

/**
 * Known resource types for polymorphic references
 */
export type NotificationResourceType =
  | "import_job"
  | "export_job"
  | "qr_export_job"
  | "brand_invite"
  | "sync_job";

export interface ImportCorrectionsRegenerateAction {
  type: "import_corrections";
  jobId: string;
}

export interface DownloadNotificationActionData {
  kind: "download";
  label: string;
  url?: string;
  expiresAt?: string;
  filename?: string;
  regenerate?: ImportCorrectionsRegenerateAction;
}

export interface LinkNotificationActionData {
  kind: "link";
  label: string;
  url?: string;
}

export type NotificationActionData =
  | DownloadNotificationActionData
  | LinkNotificationActionData;

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
  actionData: NotificationActionData | Record<string, unknown> | null;
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
  actionData?: NotificationActionData | Record<string, unknown> | null;
  /** TTL in milliseconds from now (defaults to 7 days) */
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
