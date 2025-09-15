import { sql } from "drizzle-orm";
import {
  integer,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { uniqueIndex } from "drizzle-orm/pg-core";
import { brandFacilities } from "../brands/brand-facilities";
import { products } from "./products";

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
    facilityId: uuid("facility_id")
      .references(() => brandFacilities.id, {
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
    uniqueIndex("product_journey_steps_product_sort_unq").on(
      table.productId,
      table.sortIndex,
    ),
    // RLS policies - inherit brand access through products relationship
    pgPolicy("product_journey_steps_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      )`,
    }),
    pgPolicy("product_journey_steps_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_owner(products.brand_id)
      )`,
    }),
    pgPolicy("product_journey_steps_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_owner(products.brand_id)
      )`,
    }),
    pgPolicy("product_journey_steps_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_owner(products.brand_id)
      )`,
    }),
  ],
);
