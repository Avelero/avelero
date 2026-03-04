import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { brands } from "../core/brands";

export const brandLifecycle = pgTable(
  "brand_lifecycle",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id")
      .references(() => brands.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    phase: text("phase").notNull().default("demo"),
    phaseChangedAt: timestamp("phase_changed_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    trialStartedAt: timestamp("trial_started_at", {
      withTimezone: true,
      mode: "string",
    }),
    trialEndsAt: timestamp("trial_ends_at", {
      withTimezone: true,
      mode: "string",
    }),
    cancelledAt: timestamp("cancelled_at", {
      withTimezone: true,
      mode: "string",
    }),
    hardDeleteAfter: timestamp("hard_delete_after", {
      withTimezone: true,
      mode: "string",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "brand_lifecycle_phase_check",
      sql`phase = ANY (ARRAY['demo'::text, 'trial'::text, 'expired'::text, 'active'::text, 'past_due'::text, 'suspended'::text, 'cancelled'::text])`,
    ),
    uniqueIndex("brand_lifecycle_brand_id_unq").on(table.brandId),
    index("idx_brand_lifecycle_phase").on(table.phase),
    index("idx_brand_lifecycle_trial_ends_at").on(table.trialEndsAt),
    index("idx_brand_lifecycle_hard_delete_after")
      .on(table.hardDeleteAfter)
      .where(sql`(hard_delete_after IS NOT NULL)`),
    pgPolicy("brand_lifecycle_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_lifecycle_insert_by_service_role", {
      as: "permissive",
      for: "insert",
      to: ["service_role"],
      withCheck: sql`true`,
    }),
    pgPolicy("brand_lifecycle_update_by_service_role", {
      as: "permissive",
      for: "update",
      to: ["service_role"],
      using: sql`true`,
      withCheck: sql`true`,
    }),
    pgPolicy("brand_lifecycle_delete_by_service_role", {
      as: "permissive",
      for: "delete",
      to: ["service_role"],
      using: sql`true`,
    }),
  ],
);
