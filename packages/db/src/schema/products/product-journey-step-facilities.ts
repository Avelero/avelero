import { sql } from "drizzle-orm";
import {
    index,
    integer,
    pgPolicy,
    pgTable,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";
import { brandFacilities } from "../brands/brand-facilities";
import { productJourneySteps } from "./product-journey-steps";

/**
 * Junction table for many-to-many relationship between journey steps and facilities.
 * Enables multiple operators (facilities) per journey step.
 */
export const productJourneyStepFacilities = pgTable(
    "product_journey_step_facilities",
    {
        id: uuid("id").defaultRandom().primaryKey().notNull(),
        journeyStepId: uuid("journey_step_id")
            .references(() => productJourneySteps.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            })
            .notNull(),
        facilityId: uuid("facility_id")
            .references(() => brandFacilities.id, {
                onDelete: "restrict",
                onUpdate: "cascade",
            })
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
            .defaultNow()
            .notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        // Prevent duplicate facility assignments to same journey step
        uniqueIndex("product_journey_step_facilities_unique").on(
            table.journeyStepId,
            table.facilityId,
        ),
        // Index for query performance when loading facilities for journey steps
        index("idx_journey_step_facilities_step_id").using(
            "btree",
            table.journeyStepId.asc().nullsLast().op("uuid_ops"),
        ),
        // RLS policies - inherit brand access through journey steps -> products relationship
        pgPolicy("product_journey_step_facilities_select_for_brand_members", {
            as: "permissive",
            for: "select",
            to: ["authenticated", "service_role"],
            using: sql`EXISTS (
        SELECT 1 FROM product_journey_steps pjs
        INNER JOIN products p ON pjs.product_id = p.id
        WHERE pjs.id = journey_step_id
        AND is_brand_member(p.brand_id)
      )`,
        }),
        pgPolicy("product_journey_step_facilities_insert_by_brand_member", {
            as: "permissive",
            for: "insert",
            to: ["authenticated", "service_role"],
            withCheck: sql`EXISTS (
        SELECT 1 FROM product_journey_steps pjs
        INNER JOIN products p ON pjs.product_id = p.id
        WHERE pjs.id = journey_step_id
        AND is_brand_member(p.brand_id)
      )`,
        }),
        pgPolicy("product_journey_step_facilities_update_by_brand_member", {
            as: "permissive",
            for: "update",
            to: ["authenticated", "service_role"],
            using: sql`EXISTS (
        SELECT 1 FROM product_journey_steps pjs
        INNER JOIN products p ON pjs.product_id = p.id
        WHERE pjs.id = journey_step_id
        AND is_brand_member(p.brand_id)
      )`,
        }),
        pgPolicy("product_journey_step_facilities_delete_by_brand_member", {
            as: "permissive",
            for: "delete",
            to: ["authenticated", "service_role"],
            using: sql`EXISTS (
        SELECT 1 FROM product_journey_steps pjs
        INNER JOIN products p ON pjs.product_id = p.id
        WHERE pjs.id = journey_step_id
        AND is_brand_member(p.brand_id)
      )`,
        }),
    ],
);
