import { sql } from "drizzle-orm";
import {
    index,
    integer,
    pgPolicy,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";
import { brandFacilities } from "../catalog/brand-facilities";
import { productVariants } from "./product-variants";

/**
 * Variant-level journey steps overrides.
 * When ANY rows exist for a variant, they replace (not merge with) product_journey_steps for DPP rendering.
 */
export const variantJourneySteps = pgTable(
    "variant_journey_steps",
    {
        id: uuid("id").defaultRandom().primaryKey().notNull(),
        variantId: uuid("variant_id")
            .references(() => productVariants.id, {
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
        // Source tracking: which integration wrote this data
        sourceIntegration: text("source_integration"),
        sourceExternalId: text("source_external_id"),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        // Unique constraint: one step per variant + sort index combo
        uniqueIndex("variant_journey_steps_variant_sort_unq").on(
            table.variantId,
            table.sortIndex,
        ),
        // Index for batch loading journey steps by variant
        index("idx_variant_journey_steps_variant_id").using(
            "btree",
            table.variantId.asc().nullsLast().op("uuid_ops"),
        ),
        // Index for ordering by sortIndex
        index("idx_variant_journey_steps_variant_sort").using(
            "btree",
            table.variantId.asc().nullsLast().op("uuid_ops"),
            table.sortIndex.asc().nullsLast().op("int4_ops"),
        ),
        // RLS policies - inherit brand access through product_variants → products relationship
        pgPolicy("variant_journey_steps_select_for_brand_members", {
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
        pgPolicy("variant_journey_steps_insert_by_brand_member", {
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
        pgPolicy("variant_journey_steps_update_by_brand_member", {
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
        pgPolicy("variant_journey_steps_delete_by_brand_member", {
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
