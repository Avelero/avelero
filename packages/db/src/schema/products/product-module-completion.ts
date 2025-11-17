/**
 * Product module completion tracking schema.
 *
 * Tracks completion status for each module configured in a product's template.
 * Replaces the old passport_module_completion table.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgPolicy,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { products } from "./products";

/**
 * Product module completion table
 *
 * Tracks completion status of template modules at the product level.
 * Each product can have multiple module completion records, one per enabled module.
 */
export const productModuleCompletion = pgTable(
  "product_module_completion",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    moduleKey: varchar("module_key").notNull(),
    isCompleted: boolean("is_completed").notNull().default(false),
    lastEvaluatedAt: timestamp("last_evaluated_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // One completion record per (product, module)
    uniqueIndex("product_module_completion_product_module_unq").on(
      table.productId,
      table.moduleKey,
    ),
    // Index for efficient lookups by product
    index("product_module_completion_product_id_idx").on(table.productId),
    // RLS policies
    pgPolicy("product_module_completion_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM products p
        WHERE p.id = product_id
        AND is_brand_member(p.brand_id)
      )`,
    }),
    pgPolicy("product_module_completion_insert_for_brand_members", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`EXISTS (
        SELECT 1 FROM products p
        WHERE p.id = product_id
        AND is_brand_member(p.brand_id)
      )`,
    }),
    pgPolicy("product_module_completion_update_for_brand_members", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM products p
        WHERE p.id = product_id
        AND is_brand_member(p.brand_id)
      )`,
    }),
    pgPolicy("product_module_completion_delete_for_brand_members", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM products p
        WHERE p.id = product_id
        AND is_brand_member(p.brand_id)
      )`,
    }),
    pgPolicy("product_module_completion_service_role_all", {
      as: "permissive",
      for: "all",
      to: ["service_role"],
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
);
