import { sql } from "drizzle-orm";
import {
  numeric,
  pgPolicy,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { uniqueIndex } from "drizzle-orm/pg-core";
import { brandMaterials } from "../brands/brand-materials";
import { products } from "./products";

export const productMaterials = pgTable(
  "product_materials",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    productId: uuid("product_id")
      .references(() => products.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    brandMaterialId: uuid("brand_material_id")
      .references(() => brandMaterials.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      })
      .notNull(),
    percentage: numeric("percentage", { precision: 6, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("product_materials_product_material_unq").on(
      table.productId,
      table.brandMaterialId,
    ),
    // RLS policies - inherit brand access through products relationship
    pgPolicy("product_materials_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      )`,
    }),
    pgPolicy("product_materials_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      )`,
    }),
    pgPolicy("product_materials_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      )`,
    }),
    pgPolicy("product_materials_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      )`,
    }),
  ],
);
