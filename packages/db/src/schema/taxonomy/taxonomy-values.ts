import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { taxonomyAttributes } from "./taxonomy-attributes";

export const taxonomyValues = pgTable(
  "taxonomy_values",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    attributeId: uuid("attribute_id")
      .references(() => taxonomyAttributes.id, { onDelete: "cascade" })
      .notNull(),
    friendlyId: text("friendly_id").unique().notNull(),
    publicId: text("public_id").unique().notNull(),
    publicAttributeId: text("public_attribute_id").notNull(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("taxonomy_values_attribute_id_idx").on(table.attributeId),
    index("taxonomy_values_friendly_id_idx").on(table.friendlyId),
    // RLS policies - global read-only data for authenticated users
    pgPolicy("taxonomy_values_select_for_authenticated", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`true`,
    }),
  ],
);
