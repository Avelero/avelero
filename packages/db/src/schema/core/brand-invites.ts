import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { brands } from "./brands";

export const brandInvites = pgTable(
  "brand_invites",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, {
        onDelete: "cascade",
        onUpdate: "no action",
      }),
    email: text("email").notNull(),
    role: text("role").notNull(),
    tokenHash: text("token_hash"),
    createdBy: uuid("created_by"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    // Checks
    check(
      "brand_invites_role_check",
      sql`role = ANY (ARRAY['owner'::text, 'member'::text])`,
    ),

    // Indexes (non-expression ones modelled in TS)
    index("idx_brand_invites_brand_id").using(
      "btree",
      t.brandId.asc().nullsLast().op("uuid_ops"),
    ),
    index("idx_brand_invites_expires_at").using(
      "btree",
      t.expiresAt.asc().nullsLast().op("timestamptz_ops"),
    ),
    index("idx_brand_invites_token_hash").using(
      "btree",
      t.tokenHash.asc().nullsLast().op("text_ops"),
    ),

    // Composite index for validity lookups
    index("idx_brand_invites_valid_lookup").using(
      "btree",
      t.brandId.asc().nullsLast().op("uuid_ops"),
      t.expiresAt.asc().nullsLast().op("timestamptz_ops"),
    ),

    // For listPendingInvitesForEmail - filtering by email
    index("idx_brand_invites_email").using(
      "btree",
      t.email.asc().nullsLast().op("text_ops"),
    ),
    // Composite for email + expiresAt lookups (for pending invites)
    index("idx_brand_invites_email_expires").using(
      "btree",
      t.email.asc().nullsLast().op("text_ops"),
      t.expiresAt.asc().nullsLast().op("timestamptz_ops"),
    ),

    // Partial unique index on token_hash when not null
    uniqueIndex("ux_brand_invites_token_hash_not_null")
      .using("btree", t.tokenHash.asc().nullsLast().op("text_ops"))
      .where(sql`(token_hash IS NOT NULL)`),

    // RLS policies (match existing names/semantics)
    pgPolicy("brand_invites_update_by_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_owner(brand_id)`,
    }),
    pgPolicy("brand_invites_insert_by_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`is_brand_owner(brand_id)`,
    }),
    pgPolicy("brand_invites_delete_by_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_owner(brand_id)`,
    }),
    pgPolicy("brand_invites_select_for_recipient", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("brand_invites_delete_by_recipient", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("brand_invites_select_for_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
    }),
  ],
);
