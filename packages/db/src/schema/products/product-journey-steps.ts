import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { uniqueIndex } from "drizzle-orm/pg-core";
import { products } from "./products";
import { brandOperators } from "../catalog/brand-operators";

export const productJourneySteps = pgTable(
  "product_journey_steps",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    productId: uuid("product_id")
      .references(() => products.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    sortIndex: integer("sort_index").notNull(),
    stepType: text("step_type").notNull(),
    operatorId: uuid("operator_id")
      .references(() => brandOperators.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Unique constraint: allows multiple operators per step (same product_id + sort_index)
    // but prevents duplicate operator assignments to the same step
    uniqueIndex("product_journey_steps_product_sort_operator_unq").on(
      table.productId,
      table.sortIndex,
      table.operatorId,
    ),
    // Indexes for query performance
    // For loadAttributesForProducts - batch loading journey steps
    index("idx_product_journey_steps_product_id").using(
      "btree",
      table.productId.asc().nullsLast().op("uuid_ops"),
    ),
    // For ordering by sortIndex
    index("idx_product_journey_steps_product_sort").using(
      "btree",
      table.productId.asc().nullsLast().op("uuid_ops"),
      table.sortIndex.asc().nullsLast().op("int4_ops"),
    ),
    // RLS policies - inherit brand access through products relationship
    pgPolicy("product_journey_steps_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      )`,
    }),
    pgPolicy("product_journey_steps_insert_by_brand_member", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      )`,
    }),
    pgPolicy("product_journey_steps_update_by_brand_member", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      )`,
    }),
    pgPolicy("product_journey_steps_delete_by_brand_member", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      )`,
    }),
  ],
);
