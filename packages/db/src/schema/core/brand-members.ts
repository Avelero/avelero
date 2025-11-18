import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { brands } from "./brands";
import { users } from "./users";

export const brandMembers = pgTable(
  "users_on_brand",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "no action",
      }),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, {
        onDelete: "cascade",
        onUpdate: "no action",
      }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    // Unique constraint and matching unique index (both exist in your DB)
    unique("users_on_brand_user_id_brand_id_key").on(t.userId, t.brandId),
    uniqueIndex("ux_users_on_brand_user_brand").using(
      "btree",
      t.userId.asc().nullsLast().op("uuid_ops"),
      t.brandId.asc().nullsLast().op("uuid_ops"),
    ),

    // Secondary indexes
    index("idx_users_on_brand_brand_id").using(
      "btree",
      t.brandId.asc().nullsLast().op("uuid_ops"),
    ),
    index("idx_users_on_brand_user_id").using(
      "btree",
      t.userId.asc().nullsLast().op("uuid_ops"),
    ),

    // Check constraint
    check(
      "users_on_brand_role_check",
      sql`role = ANY (ARRAY['owner'::text, 'member'::text])`,
    ),

    // RLS policies
    pgPolicy("users_on_brand_update_by_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_owner(brand_id)`,
    }),
    pgPolicy("users_on_brand_select_for_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("users_on_brand_delete_self", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("users_on_brand_delete_owner_non_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("users_on_brand_insert_first_owner_self", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
    }),
  ],
);
