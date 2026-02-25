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
import { brands } from "./brands";
import { users } from "./users";

export const platformAdminAuditLogs = pgTable(
  "platform_admin_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    actorEmail: text("actor_email").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id"),
    brandId: uuid("brand_id").references(() => brands.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_platform_admin_audit_logs_created_at").using(
      "btree",
      table.createdAt.asc().nullsLast().op("timestamptz_ops"),
    ),
    index("idx_platform_admin_audit_logs_brand_id").using(
      "btree",
      table.brandId.asc().nullsLast().op("uuid_ops"),
    ),
    index("idx_platform_admin_audit_logs_actor_user_id").using(
      "btree",
      table.actorUserId.asc().nullsLast().op("uuid_ops"),
    ),
    index("idx_platform_admin_audit_logs_action").using(
      "btree",
      table.action.asc().nullsLast().op("text_ops"),
    ),
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
    }),
    pgPolicy("platform_admin_audit_logs_delete_by_service_role", {
      as: "permissive",
      for: "delete",
      to: ["service_role"],
      using: sql`true`,
    }),
  ],
);

