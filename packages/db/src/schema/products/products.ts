import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
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
    tags: text("tags"), // Pipe-separated tags
    brandCertificationId: uuid("brand_certification_id").references(
      () => brandCertifications.id,
      {
        onDelete: "set null",
        onUpdate: "cascade",
      },
    ),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
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
