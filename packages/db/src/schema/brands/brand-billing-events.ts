import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { brands } from "../core/brands";

export const brandBillingEvents = pgTable(
  "brand_billing_events",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id")
      .references(() => brands.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    eventType: text("event_type").notNull(),
    stripeEventId: text("stripe_event_id"),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_brand_billing_events_brand_created_at").on(
      table.brandId,
      table.createdAt,
    ),
    index("idx_brand_billing_events_event_type").on(table.eventType),
    uniqueIndex("brand_billing_events_stripe_event_id_unq")
      .on(table.stripeEventId)
      .where(sql`(stripe_event_id IS NOT NULL)`),
    pgPolicy("brand_billing_events_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_billing_events_insert_by_service_role", {
      as: "permissive",
      for: "insert",
      to: ["service_role"],
      withCheck: sql`true`,
    }),
    pgPolicy("brand_billing_events_update_by_service_role", {
      as: "permissive",
      for: "update",
      to: ["service_role"],
      using: sql`true`,
      withCheck: sql`true`,
    }),
    pgPolicy("brand_billing_events_delete_by_service_role", {
      as: "permissive",
      for: "delete",
      to: ["service_role"],
      using: sql`true`,
    }),
  ],
);
