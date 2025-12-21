import { sql } from "drizzle-orm";
import {
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const taxonomyAttributes = pgTable(
  "taxonomy_attributes",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    friendlyId: text("friendly_id").unique().notNull(),
    publicId: text("public_id").unique().notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("taxonomy_attributes_friendly_id_idx").on(table.friendlyId),
    // RLS policies - global read-only data for authenticated users
    pgPolicy("taxonomy_attributes_select_for_authenticated", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`true`,
    }),
  ],
);
