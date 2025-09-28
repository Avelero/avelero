import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, timestamp, uuid, text, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { passports } from "./passports";

export const passportModuleCompletion = pgTable(
  "passport_module_completion",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    passportId: uuid("passport_id")
      .references(() => passports.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    moduleKey: text("module_key").notNull(),
    isCompleted: boolean("is_completed").notNull().default(false),
    lastEvaluatedAt: timestamp("last_evaluated_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("passport_module_completion_passport_module_unq").on(
      table.passportId,
      table.moduleKey,
    ),
    index("passport_module_completion_passport_id_idx").on(table.passportId),
    index("passport_module_completion_module_completed_idx").on(
      table.moduleKey,
      table.isCompleted,
    ),
    // RLS policies
    pgPolicy("passport_module_completion_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`is_brand_member((SELECT brand_id FROM passports WHERE id = passport_id))`,
    }),
    pgPolicy("passport_module_completion_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`is_brand_member((SELECT brand_id FROM passports WHERE id = passport_id))`,
    }),
    pgPolicy("passport_module_completion_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`is_brand_member((SELECT brand_id FROM passports WHERE id = passport_id))`,
    }),
    pgPolicy("passport_module_completion_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_member((SELECT brand_id FROM passports WHERE id = passport_id))`,
    }),
  ],
);
