/**
 * Product delete job schema.
 *
 * Tracks large background product deletions that snapshot their target set and
 * process products in chunks outside the request/response cycle.
 */

import { sql } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { brands } from "../core/brands";
import { users } from "../core/users";

export const productDeleteJobs = pgTable(
  "product_delete_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id")
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    userEmail: text("user_email"),
    status: text("status").notNull().default("PENDING"),
    selectionMode: text("selection_mode").notNull(),
    includeIds: text("include_ids").array(),
    excludeIds: text("exclude_ids").array(),
    filterState: jsonb("filter_state"),
    searchQuery: text("search_query"),
    totalProducts: integer("total_products").default(0),
    productsProcessed: integer("products_processed").default(0),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", {
      withTimezone: true,
      mode: "string",
    }),
    summary: jsonb("summary"),
  },
  () => [
    pgPolicy("product_delete_jobs_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("product_delete_jobs_insert_by_brand_member", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("product_delete_jobs_update_by_brand_member", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
      withCheck: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("product_delete_jobs_delete_by_brand_member", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
  ],
);
