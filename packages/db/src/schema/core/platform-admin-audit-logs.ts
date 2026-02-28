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
import { users } from "./users";

export const platformAdminAuditLogs = pgTable(
  "platform_admin_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull().default("unknown"),
    resourceId: text("resource_id").notNull().default("unknown"),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_platform_admin_audit_logs_actor_user_id").on(table.actorUserId),
    index("idx_platform_admin_audit_logs_resource").on(
      table.resourceType,
      table.resourceId,
    ),
    index("idx_platform_admin_audit_logs_created_at").on(table.createdAt),
    pgPolicy("platform_admin_audit_logs_select_by_service_role", {
      as: "permissive",
      for: "select",
      to: ["service_role"],
      using: sql`true`,
    }),
    pgPolicy("platform_admin_audit_logs_insert_by_service_role", {
      as: "permissive",
      for: "insert",
      to: ["service_role"],
      withCheck: sql`true`,
    }),
    pgPolicy("platform_admin_audit_logs_update_by_service_role", {
      as: "permissive",
      for: "update",
      to: ["service_role"],
      using: sql`true`,
      withCheck: sql`true`,
    }),
    pgPolicy("platform_admin_audit_logs_delete_by_service_role", {
      as: "permissive",
      for: "delete",
      to: ["service_role"],
      using: sql`true`,
    }),
  ],
);
