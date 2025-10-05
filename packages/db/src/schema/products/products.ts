import { sql } from "drizzle-orm";
import {
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { brandCertifications } from "../brands/brand-certifications";
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
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    season: text("season"),
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
  (table) => ({
    // Performance indexes for new query patterns
    brandCreatedIdx: index("products_brand_created_idx").on(
      table.brandId,
      table.createdAt,
    ),
    brandNameIdx: index("products_brand_name_idx").on(
      table.brandId,
      table.name,
    ),
    nameSearchIdx: index("products_name_search_idx").on(table.name),
    categoryIdx: index("products_category_idx").on(table.categoryId),
    showcaseBrandIdx: index("products_showcase_brand_idx").on(
      table.showcaseBrandId,
    ),
    seasonIdx: index("products_season_idx").on(table.season),
    updatedAtIdx: index("products_updated_at_idx").on(table.updatedAt),

    // RLS policies
    productsSelectForBrandMembers: pgPolicy(
      "products_select_for_brand_members",
      {
        as: "permissive",
        for: "select",
        to: ["authenticated"],
        using: sql`is_brand_member(brand_id)`,
      },
    ),
    productsInsertByBrandOwner: pgPolicy("products_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`is_brand_member(brand_id)`,
    }),
    productsUpdateByBrandOwner: pgPolicy("products_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
    productsDeleteByBrandOwner: pgPolicy("products_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
  }),
);
