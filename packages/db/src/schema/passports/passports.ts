import { sql } from "drizzle-orm";
import {
  index,
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
  (table) => ({
    // One passport per (brand, product, variant)
    uniqueIndexBrandProductVariant: uniqueIndex("passports_brand_product_variant_unq").on(
      table.brandId,
      table.productId,
      table.variantId,
    ),
    // Ensure slug uniqueness (UPID-driven)
    uniqueIndexSlug: uniqueIndex("passports_slug_unq").on(table.slug),

    // Performance indexes for brand-scoped queries
    brandStatusIdx: index("passports_brand_status_idx").on(
      table.brandId,
      table.status,
    ),
    brandCreatedIdx: index("passports_brand_created_idx").on(
      table.brandId,
      table.createdAt,
    ),
    brandUpdatedIdx: index("passports_brand_updated_idx").on(
      table.brandId,
      table.updatedAt,
    ),

    // Product and variant relationship indexes
    productIdx: index("passports_product_idx").on(table.productId),
    variantIdx: index("passports_variant_idx").on(table.variantId),
    templateIdx: index("passports_template_idx").on(table.templateId),

    // Slug index for lookups
    slugIdx: index("passports_slug_idx").on(table.slug),

    // RLS policies
    passportsSelectForBrandMembers: pgPolicy("passports_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
    passportsInsertByBrandOwner: pgPolicy("passports_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`is_brand_member(brand_id)`,
    }),
    passportsUpdateByBrandOwner: pgPolicy("passports_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
    passportsDeleteByBrandOwner: pgPolicy("passports_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
  }),
);

export type Passport = typeof passports.$inferSelect;
export type NewPassport = typeof passports.$inferInsert;
