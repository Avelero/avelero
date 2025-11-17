import { sql } from "drizzle-orm";
import {
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { brandCertifications } from "../brands/brand-certifications";
import { brandSeasons } from "../brands/brand-seasons";
import { categories } from "../brands/categories";
import { showcaseBrands } from "../brands/showcase-brands";
import { brands } from "../core/brands";

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id")
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    /**
     * Unique product identifier within the brand.
     * This is the primary identifier for products, used for matching and tracking.
     * Replaces SKU as the main product identifier.
     */
    productIdentifier: text("product_identifier").notNull(),
    /**
     * Product-level UPID (Unique Product Identifier).
     * 16-character lowercase alphanumeric string for product passport URLs.
     * Used in routes like /passport/edit/{upid}.
     * Must be unique within a brand.
     */
    upid: text("upid"),
    description: text("description"),
    showcaseBrandId: uuid("showcase_brand_id").references(
      () => showcaseBrands.id,
      {
        onDelete: "set null",
        onUpdate: "cascade",
      },
    ),
    primaryImageUrl: text("primary_image_url"),
    additionalImageUrls: text("additional_image_urls"), // Pipe-separated URLs
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    season: text("season"), // TODO: Migrate to seasonId FK
    seasonId: uuid("season_id").references(() => brandSeasons.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    tags: text("tags"), // Pipe-separated tags (legacy - use brand_tags for new implementations)
    brandCertificationId: uuid("brand_certification_id").references(
      () => brandCertifications.id,
      {
        onDelete: "set null",
        onUpdate: "cascade",
      },
    ),
    /**
     * Product publication status.
     * Valid values: 'published', 'unpublished', 'archived', 'scheduled'
     */
    status: text("status").notNull().default("unpublished"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Unique constraint: product_identifier must be unique within each brand
    uniqueIndex("products_brand_id_product_identifier_unq").on(
      table.brandId,
      table.productIdentifier,
    ),
    // RLS policies - both members and owners can perform all operations
    pgPolicy("products_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("products_insert_by_brand_members", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("products_update_by_brand_members", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("products_delete_by_brand_members", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
  ],
);