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
import { brandCertifications } from "../../brands/brand-certifications";
import { brandColors } from "../../brands/brand-colors";
import { brandEcoClaims } from "../../brands/brand-eco-claims";
import { brandFacilities } from "../../brands/brand-facilities";
import { brandManufacturers } from "../../brands/brand-manufacturers";
import { brandMaterials } from "../../brands/brand-materials";
import { brandSeasons } from "../../brands/brand-seasons";
import { brandSizes } from "../../brands/brand-sizes";
import { brandTags } from "../../brands/brand-tags";
import { brandIntegrations } from "../brand-integrations";

/**
 * Integration entity link tables
 *
 * These tables map external entity IDs to Avelero entity IDs for each integration.
 * This enables the "link-first, name-fallback" matching strategy:
 * 1. First, check if we have a link for this external ID
 * 2. If not, try to find by name/identifier
 * 3. If still not found, create new entity and link
 *
 * This allows brands to rename entities in Avelero without breaking sync.
 *
 * @see plan-integration.md Section 6.3 for matching strategy details
 */

// =============================================================================
// HELPER: Create standard RLS policies for entity link tables
// =============================================================================

const createEntityLinkPolicies = (tableName: string) => [
  pgPolicy(`${tableName}_select_for_brand_members`, {
    as: "permissive",
    for: "select",
    to: ["authenticated", "service_role"],
    using: sql`EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    )`,
  }),
  pgPolicy(`${tableName}_insert_by_brand_member`, {
    as: "permissive",
    for: "insert",
    to: ["authenticated", "service_role"],
    withCheck: sql`EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    )`,
  }),
  pgPolicy(`${tableName}_update_by_brand_member`, {
    as: "permissive",
    for: "update",
    to: ["authenticated", "service_role"],
    using: sql`EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    )`,
  }),
  pgPolicy(`${tableName}_delete_by_brand_member`, {
    as: "permissive",
    for: "delete",
    to: ["authenticated", "service_role"],
    using: sql`EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    )`,
  }),
];

// =============================================================================
// MATERIAL LINKS
// =============================================================================

export const integrationMaterialLinks = pgTable(
  "integration_material_links",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandIntegrationId: uuid("brand_integration_id")
      .references(() => brandIntegrations.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    materialId: uuid("material_id")
      .references(() => brandMaterials.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    externalId: text("external_id").notNull(),
    externalName: text("external_name"),
    lastSyncedAt: timestamp("last_synced_at", {
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
    uniqueIndex("integration_material_links_integration_external_unq").on(
      table.brandIntegrationId,
      table.externalId,
    ),
    uniqueIndex("integration_material_links_integration_material_unq").on(
      table.brandIntegrationId,
      table.materialId,
    ),
    index("idx_integration_material_links_material").on(table.materialId),
    ...createEntityLinkPolicies("integration_material_links"),
  ],
);

// =============================================================================
// FACILITY LINKS
// =============================================================================

export const integrationFacilityLinks = pgTable(
  "integration_facility_links",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandIntegrationId: uuid("brand_integration_id")
      .references(() => brandIntegrations.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    facilityId: uuid("facility_id")
      .references(() => brandFacilities.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    externalId: text("external_id").notNull(),
    externalName: text("external_name"),
    lastSyncedAt: timestamp("last_synced_at", {
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
    uniqueIndex("integration_facility_links_integration_external_unq").on(
      table.brandIntegrationId,
      table.externalId,
    ),
    uniqueIndex("integration_facility_links_integration_facility_unq").on(
      table.brandIntegrationId,
      table.facilityId,
    ),
    index("idx_integration_facility_links_facility").on(table.facilityId),
    ...createEntityLinkPolicies("integration_facility_links"),
  ],
);

// =============================================================================
// MANUFACTURER LINKS
// =============================================================================

export const integrationManufacturerLinks = pgTable(
  "integration_manufacturer_links",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandIntegrationId: uuid("brand_integration_id")
      .references(() => brandIntegrations.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    manufacturerId: uuid("manufacturer_id")
      .references(() => brandManufacturers.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    externalId: text("external_id").notNull(),
    externalName: text("external_name"),
    lastSyncedAt: timestamp("last_synced_at", {
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
    uniqueIndex("integration_manufacturer_links_integration_external_unq").on(
      table.brandIntegrationId,
      table.externalId,
    ),
    uniqueIndex("integration_manufacturer_links_integration_mfr_unq").on(
      table.brandIntegrationId,
      table.manufacturerId,
    ),
    index("idx_integration_manufacturer_links_mfr").on(table.manufacturerId),
    ...createEntityLinkPolicies("integration_manufacturer_links"),
  ],
);

// =============================================================================
// SEASON LINKS
// =============================================================================

export const integrationSeasonLinks = pgTable(
  "integration_season_links",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandIntegrationId: uuid("brand_integration_id")
      .references(() => brandIntegrations.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    seasonId: uuid("season_id")
      .references(() => brandSeasons.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    externalId: text("external_id").notNull(),
    externalName: text("external_name"),
    lastSyncedAt: timestamp("last_synced_at", {
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
    uniqueIndex("integration_season_links_integration_external_unq").on(
      table.brandIntegrationId,
      table.externalId,
    ),
    uniqueIndex("integration_season_links_integration_season_unq").on(
      table.brandIntegrationId,
      table.seasonId,
    ),
    index("idx_integration_season_links_season").on(table.seasonId),
    ...createEntityLinkPolicies("integration_season_links"),
  ],
);

// =============================================================================
// COLOR LINKS
// =============================================================================

export const integrationColorLinks = pgTable(
  "integration_color_links",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandIntegrationId: uuid("brand_integration_id")
      .references(() => brandIntegrations.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    colorId: uuid("color_id")
      .references(() => brandColors.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    externalId: text("external_id").notNull(),
    externalName: text("external_name"),
    lastSyncedAt: timestamp("last_synced_at", {
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
    uniqueIndex("integration_color_links_integration_external_unq").on(
      table.brandIntegrationId,
      table.externalId,
    ),
    uniqueIndex("integration_color_links_integration_color_unq").on(
      table.brandIntegrationId,
      table.colorId,
    ),
    index("idx_integration_color_links_color").on(table.colorId),
    ...createEntityLinkPolicies("integration_color_links"),
  ],
);

// =============================================================================
// SIZE LINKS
// =============================================================================

export const integrationSizeLinks = pgTable(
  "integration_size_links",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandIntegrationId: uuid("brand_integration_id")
      .references(() => brandIntegrations.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    sizeId: uuid("size_id")
      .references(() => brandSizes.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    externalId: text("external_id").notNull(),
    externalName: text("external_name"),
    lastSyncedAt: timestamp("last_synced_at", {
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
    uniqueIndex("integration_size_links_integration_external_unq").on(
      table.brandIntegrationId,
      table.externalId,
    ),
    uniqueIndex("integration_size_links_integration_size_unq").on(
      table.brandIntegrationId,
      table.sizeId,
    ),
    index("idx_integration_size_links_size").on(table.sizeId),
    ...createEntityLinkPolicies("integration_size_links"),
  ],
);

// =============================================================================
// TAG LINKS
// =============================================================================

export const integrationTagLinks = pgTable(
  "integration_tag_links",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandIntegrationId: uuid("brand_integration_id")
      .references(() => brandIntegrations.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    tagId: uuid("tag_id")
      .references(() => brandTags.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    externalId: text("external_id").notNull(),
    externalName: text("external_name"),
    lastSyncedAt: timestamp("last_synced_at", {
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
    uniqueIndex("integration_tag_links_integration_external_unq").on(
      table.brandIntegrationId,
      table.externalId,
    ),
    uniqueIndex("integration_tag_links_integration_tag_unq").on(
      table.brandIntegrationId,
      table.tagId,
    ),
    index("idx_integration_tag_links_tag").on(table.tagId),
    ...createEntityLinkPolicies("integration_tag_links"),
  ],
);

// =============================================================================
// ECO CLAIM LINKS
// =============================================================================

export const integrationEcoClaimLinks = pgTable(
  "integration_eco_claim_links",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandIntegrationId: uuid("brand_integration_id")
      .references(() => brandIntegrations.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    ecoClaimId: uuid("eco_claim_id")
      .references(() => brandEcoClaims.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    externalId: text("external_id").notNull(),
    externalName: text("external_name"),
    lastSyncedAt: timestamp("last_synced_at", {
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
    uniqueIndex("integration_eco_claim_links_integration_external_unq").on(
      table.brandIntegrationId,
      table.externalId,
    ),
    uniqueIndex("integration_eco_claim_links_integration_claim_unq").on(
      table.brandIntegrationId,
      table.ecoClaimId,
    ),
    index("idx_integration_eco_claim_links_claim").on(table.ecoClaimId),
    ...createEntityLinkPolicies("integration_eco_claim_links"),
  ],
);

// =============================================================================
// CERTIFICATION LINKS
// =============================================================================

export const integrationCertificationLinks = pgTable(
  "integration_certification_links",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandIntegrationId: uuid("brand_integration_id")
      .references(() => brandIntegrations.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    certificationId: uuid("certification_id")
      .references(() => brandCertifications.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    externalId: text("external_id").notNull(),
    externalName: text("external_name"),
    lastSyncedAt: timestamp("last_synced_at", {
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
    uniqueIndex("integration_certification_links_integration_external_unq").on(
      table.brandIntegrationId,
      table.externalId,
    ),
    uniqueIndex("integration_certification_links_integration_cert_unq").on(
      table.brandIntegrationId,
      table.certificationId,
    ),
    index("idx_integration_certification_links_cert").on(table.certificationId),
    ...createEntityLinkPolicies("integration_certification_links"),
  ],
);
