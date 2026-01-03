import { sql } from "drizzle-orm";
import {
    index,
    pgPolicy,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";
import { brandEcoClaims } from "../catalog/brand-eco-claims";
import { productVariants } from "./product-variants";

/**
 * Variant-level eco claims overrides.
 * When ANY rows exist for a variant, they replace (not merge with) product_eco_claims for DPP rendering.
 */
export const variantEcoClaims = pgTable(
    "variant_eco_claims",
    {
        id: uuid("id").defaultRandom().primaryKey().notNull(),
        variantId: uuid("variant_id")
            .references(() => productVariants.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            })
            .notNull(),
        ecoClaimId: uuid("eco_claim_id")
            .references(() => brandEcoClaims.id, {
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
        // Unique constraint: one eco claim per variant
        uniqueIndex("variant_eco_claims_unique").on(
            table.variantId,
            table.ecoClaimId,
        ),
        // Index for batch loading eco claims by variant
        index("idx_variant_eco_claims_variant_id").using(
            "btree",
            table.variantId.asc().nullsLast().op("uuid_ops"),
        ),
        // RLS policies - inherit brand access through product_variants → products relationship
        pgPolicy("variant_eco_claims_select_for_brand_members", {
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
        pgPolicy("variant_eco_claims_insert_by_brand_member", {
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
        pgPolicy("variant_eco_claims_update_by_brand_member", {
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
        pgPolicy("variant_eco_claims_delete_by_brand_member", {
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
