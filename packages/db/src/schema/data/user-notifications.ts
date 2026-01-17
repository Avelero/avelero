import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { brands } from "../core/brands";
import { users } from "../core/users";

/**
 * User notifications table for in-app notification delivery.
 *
 * This table stores user-specific notifications that are:
 * - Scoped to a specific user (not brand-wide)
 * - Tracked for read/seen/dismissed state server-side
 * - Delivered in real-time via Supabase Realtime
 * - Auto-expired after a configurable TTL
 *
 * Notification types:
 * - import_failure: Bulk import had errors
 * - export_ready: Export file is ready for download
 * - sync_complete: Integration sync finished
 * - sync_failure: Integration sync had errors
 *
 * Resource types (polymorphic reference):
 * - import_job: Links to import_jobs table
 * - export_job: Links to export_jobs table
 * - sync_job: Links to integration_sync_jobs table
 */
export const userNotifications = pgTable(
  "user_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),

    // Who receives this notification
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    brandId: uuid("brand_id")
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),

    // Notification content
    type: text("type").notNull(), // 'import_failure', 'export_ready', 'sync_complete', etc.
    title: text("title").notNull(),
    message: text("message"),

    // Link to source entity (polymorphic reference)
    resourceType: text("resource_type"), // 'import_job', 'export_job', 'sync_job', etc.
    resourceId: uuid("resource_id"),

    // Action configuration
    actionUrl: text("action_url"), // Click-through URL
    actionData: jsonb("action_data"), // Additional data for the action

    // State tracking
    seenAt: timestamp("seen_at", { withTimezone: true, mode: "string" }), // NULL = unread
    dismissedAt: timestamp("dismissed_at", {
      withTimezone: true,
      mode: "string",
    }), // NULL = active

    // Lifecycle
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }), // Optional TTL
  },
  (table) => [
    // Index for fetching unread notifications for a user
    // Most common query: "get unread count for this user in this brand"
    index("idx_user_notifications_user_unread")
      .using(
        "btree",
        table.userId.asc().nullsLast(),
        table.brandId.asc().nullsLast(),
      )
      .where(sql`(seen_at IS NULL AND dismissed_at IS NULL)`),

    // Index for cleanup of expired notifications
    index("idx_user_notifications_expires")
      .using("btree", table.expiresAt.asc().nullsLast())
      .where(sql`(expires_at IS NOT NULL)`),

    // Index for fetching notifications by resource (e.g., find notification for a specific job)
    index("idx_user_notifications_resource")
      .using(
        "btree",
        table.resourceType.asc().nullsLast(),
        table.resourceId.asc().nullsLast(),
      )
      .where(sql`(resource_type IS NOT NULL AND resource_id IS NOT NULL)`),

    // RLS policies: User can only access their own notifications
    pgPolicy("user_notifications_select_own", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`auth.uid() = user_id`,
    }),
    pgPolicy("user_notifications_insert_service", {
      as: "permissive",
      for: "insert",
      to: ["service_role"],
      // Service role can create notifications for any user
      withCheck: sql`true`,
    }),
    pgPolicy("user_notifications_update_own", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      // User can only update their own notifications (for marking as seen/dismissed)
      using: sql`auth.uid() = user_id`,
    }),
    pgPolicy("user_notifications_delete_own", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`auth.uid() = user_id`,
    }),
  ],
);
