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

export const stripeWebhookEvents = pgTable(
  "stripe_webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    stripeEventId: text("stripe_event_id").notNull(),
    eventType: text("event_type").notNull(),
    processedAt: timestamp("processed_at", {
      withTimezone: true,
      mode: "string",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("stripe_webhook_events_stripe_event_id_unq").on(
      table.stripeEventId,
    ),
    index("idx_stripe_webhook_events_processed_at").on(table.processedAt),
    pgPolicy("stripe_webhook_events_select_by_service_role", {
      as: "permissive",
      for: "select",
      to: ["service_role"],
      using: sql`true`,
    }),
    pgPolicy("stripe_webhook_events_insert_by_service_role", {
      as: "permissive",
      for: "insert",
      to: ["service_role"],
      withCheck: sql`true`,
    }),
    pgPolicy("stripe_webhook_events_update_by_service_role", {
      as: "permissive",
      for: "update",
      to: ["service_role"],
      using: sql`true`,
      withCheck: sql`true`,
    }),
    pgPolicy("stripe_webhook_events_delete_by_service_role", {
      as: "permissive",
      for: "delete",
      to: ["service_role"],
      using: sql`true`,
    }),
  ],
);
