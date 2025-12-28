import { sql } from "drizzle-orm";
import {
    index,
    numeric,
    pgPolicy,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";
import { brandMaterials } from "../catalog/brand-materials";
import { productVariants } from "./product-variants";

/**
 * Variant-level materials overrides.
 * When ANY rows exist for a variant, they replace (not merge with) product_materials for DPP rendering.
 */
export const variantMaterials = pgTable(
    "variant_materials",
    {
        id: uuid("id").defaultRandom().primaryKey().notNull(),
        variantId: uuid("variant_id")
            .references(() => productVariants.id, {
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
        // Source tracking: which integration wrote this data
        sourceIntegration: text("source_integration"),
        sourceExternalId: text("source_external_id"),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        // Unique constraint: one material entry per variant + material combo
        uniqueIndex("variant_materials_variant_material_unq").on(
            table.variantId,
            table.brandMaterialId,
        ),
        // Index for batch loading materials by variant
        index("idx_variant_materials_variant_id").using(
            "btree",
            table.variantId.asc().nullsLast().op("uuid_ops"),
        ),
        // RLS policies - inherit brand access through product_variants → products relationship
        pgPolicy("variant_materials_select_for_brand_members", {
            as: "permissive",
            for: "select",
            to: ["authenticated", "service_role"],
            using: sql`EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      )`,
        }),
        pgPolicy("variant_materials_insert_by_brand_member", {
            as: "permissive",
            for: "insert",
            to: ["authenticated", "service_role"],
            withCheck: sql`EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      )`,
        }),
        pgPolicy("variant_materials_update_by_brand_member", {
            as: "permissive",
            for: "update",
            to: ["authenticated", "service_role"],
            using: sql`EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      )`,
        }),
        pgPolicy("variant_materials_delete_by_brand_member", {
            as: "permissive",
            for: "delete",
            to: ["authenticated", "service_role"],
            using: sql`EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      )`,
        }),
    ],
);
