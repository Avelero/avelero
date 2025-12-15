import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { brandIntegrations } from "./brand-integrations";

/**
 * Integration field configurations table
 * Stores field ownership and source options for each field per integration
 *
 * Field keys follow the pattern: `{entity}.{fieldName}`
 * Example: `product.name`, `material.recyclable`, `facility.city`
 *
 * @see packages/integrations/src/registry/field-registry.ts for available fields
 * @see plan-integration.md for architecture details
 */
export const integrationFieldConfigs = pgTable(
  "integration_field_configs",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandIntegrationId: uuid("brand_integration_id")
      .references(() => brandIntegrations.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    /** Field key from field registry (e.g., "product.name", "product.price") */
    fieldKey: text("field_key").notNull(),
    /** Whether this integration owns this field (enables sync for this field) */
    ownershipEnabled: boolean("ownership_enabled").notNull().default(true),
    /** Selected source option key (e.g., "sku", "barcode", "handle") */
    sourceOptionKey: text("source_option_key"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Unique constraint: one config per field per integration
    uniqueIndex("integration_field_configs_integration_field_unq").on(
      table.brandIntegrationId,
      table.fieldKey,
    ),
    // Index for querying by integration
    index("idx_integration_field_configs_integration").on(
      table.brandIntegrationId,
    ),
    // RLS policies - access via brand_integrations join
    pgPolicy("integration_field_configs_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      )`,
    }),
    pgPolicy("integration_field_configs_insert_by_brand_member", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      )`,
    }),
    pgPolicy("integration_field_configs_update_by_brand_member", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      )`,
    }),
    pgPolicy("integration_field_configs_delete_by_brand_member", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      )`,
    }),
  ],
);
