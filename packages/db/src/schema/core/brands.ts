import { sql } from "drizzle-orm";
import { pgTable, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { check, index, pgPolicy, uniqueIndex } from "drizzle-orm/pg-core";

export const brands = pgTable(
  "brands",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    name: text("name").notNull(),
    slug: text("slug"),
    email: text("email"),
    countryCode: text("country_code"),
    logoPath: text("logo_path"),
    avatarHue: smallint("avatar_hue"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    // Index for filtering active (non-deleted) brands
    index("idx_brands_active").on(table.id).where(sql`(deleted_at IS NULL)`),
    // Unique index for slug (used in public DPP URLs)
    uniqueIndex("idx_brands_slug")
      .on(table.slug)
      .where(sql`(slug IS NOT NULL)`),
    index("idx_brands_email").using(
      "btree",
      table.email.asc().nullsLast().op("text_ops"),
    ),
    index("idx_brands_avatar_hue")
      .using("btree", table.avatarHue.asc().nullsLast().op("int2_ops"))
      .where(sql`(avatar_hue IS NOT NULL)`),
    check(
      "brands_avatar_hue_check",
      sql`(avatar_hue IS NULL) OR ((avatar_hue >= 1) AND (avatar_hue <= 360))`,
    ),
    pgPolicy("brands_update_by_member", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(id)`,
    }),
    pgPolicy("brands_delete_by_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_owner(id)`,
    }),
    pgPolicy("brands_select_for_invite_recipients", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("brands_select_for_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(id)`,
    }),
    pgPolicy("brands_insert_by_authenticated", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
    }),
  ],
);
