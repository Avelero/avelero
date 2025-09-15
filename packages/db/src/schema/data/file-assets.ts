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
import { brands } from "../core/brands";

export const fileAssets = pgTable(
  "file_assets",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id").references(() => brands.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    bucket: text("bucket").notNull(),
    path: text("path").notNull(),
    mimeType: text("mime_type"),
    bytes: integer("bytes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("file_assets_bucket_path_unq").on(table.bucket, table.path),
    // RLS policies - handle both brand-specific and global files
    pgPolicy("file_assets_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`(brand_id IS NULL) OR is_brand_member(brand_id)`,
    }),
    pgPolicy("file_assets_insert_by_brand_owner_or_system", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`(brand_id IS NULL) OR is_brand_owner(brand_id)`,
    }),
    pgPolicy("file_assets_update_by_brand_owner_or_system", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`(brand_id IS NULL) OR is_brand_owner(brand_id)`,
    }),
    pgPolicy("file_assets_delete_by_brand_owner_or_system", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`(brand_id IS NULL) OR is_brand_owner(brand_id)`,
    }),
  ],
);
