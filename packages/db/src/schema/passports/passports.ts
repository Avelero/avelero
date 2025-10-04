import { sql } from "drizzle-orm";
import {
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { brands } from "../core/brands";
import { passportTemplates } from "../passports/passport-templates";
import { productVariants } from "../products/product-variants";
import { products } from "../products/products";

export const passports = pgTable(
  "passports",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id")
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    productId: uuid("product_id")
      .references(() => products.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    variantId: uuid("variant_id")
      .references(() => productVariants.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    templateId: uuid("template_id")
      .references(() => passportTemplates.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    status: varchar("status").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // One passport per (brand, product, variant)
    uniqueIndex("passports_brand_product_variant_unq").on(
      table.brandId,
      table.productId,
      table.variantId,
    ),
    // Ensure slug uniqueness (UPID-driven)
    uniqueIndex("passports_slug_unq").on(table.slug),
    // RLS policies
    pgPolicy("passports_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("passports_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("passports_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("passports_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
  ],
);
