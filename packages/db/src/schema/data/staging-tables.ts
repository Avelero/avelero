import { sql } from "drizzle-orm";
import {
  integer,
  numeric,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { importJobs } from "./import-jobs";
import { products } from "../products/products";
import { productVariants } from "../products/product-variants";
import { brandMaterials } from "../brands/brand-materials";
import { careCodes } from "../brands/care-codes";
import { brandEcoClaims } from "../brands/brand-eco-claims";
import { brandFacilities } from "../brands/brand-facilities";
import { productJourneySteps } from "../products/product-journey-steps";
import { productEnvironment } from "../products/product-environment";
import { productIdentifiers } from "../products/product-identifiers";
import { productVariantIdentifiers } from "../products/product-variant-identifiers";

/**
 * Staging table for products during bulk import Phase 1
 * Stores validated product data before committing to production
 */
export const stagingProducts = pgTable(
  "staging_products",
  {
    // Staging metadata
    stagingId: uuid("staging_id").defaultRandom().primaryKey().notNull(),
    jobId: uuid("job_id")
      .references(() => importJobs.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    rowNumber: integer("row_number").notNull(),
    action: text("action").notNull(), // 'CREATE' or 'UPDATE'
    existingProductId: uuid("existing_product_id").references(
      () => products.id,
      {
        onDelete: "cascade",
        onUpdate: "cascade",
      },
    ),

    // Product fields (mirroring products table)
    id: uuid("id").notNull(), // Planned product ID for CREATE, existing ID for UPDATE
    brandId: uuid("brand_id").notNull(),
    productIdentifier: text("product_identifier"), // Product identifier for matching/tracking
    name: text("name").notNull(),
    description: text("description"),
    showcaseBrandId: uuid("showcase_brand_id"),
    primaryImageUrl: text("primary_image_url"),
    additionalImageUrls: text("additional_image_urls"), // Pipe-separated URLs
    categoryId: uuid("category_id"),
    season: text("season"), // TODO: Migrate to seasonId FK
    seasonId: uuid("season_id"),
    tags: text("tags"), // Pipe-separated tags
    brandCertificationId: uuid("brand_certification_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Indexes for performance
    index("staging_products_job_id_idx").on(table.jobId),
    index("staging_products_brand_id_idx").on(table.brandId),
    index("staging_products_action_idx").on(table.action),
    index("staging_products_existing_product_id_idx").on(
      table.existingProductId,
    ),
    uniqueIndex("staging_products_job_row_unq").on(
      table.jobId,
      table.rowNumber,
    ),

    // RLS policies - access through import_jobs brand ownership
    pgPolicy("staging_products_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_products_insert_by_system", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_products_update_by_system", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_products_delete_by_system", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
  ],
);

/**
 * Staging table for product variants during bulk import Phase 1
 * Stores validated variant data before committing to production
 */
export const stagingProductVariants = pgTable(
  "staging_product_variants",
  {
    // Staging metadata
    stagingId: uuid("staging_id").defaultRandom().primaryKey().notNull(),
    stagingProductId: uuid("staging_product_id")
      .references(() => stagingProducts.stagingId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    jobId: uuid("job_id")
      .references(() => importJobs.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    rowNumber: integer("row_number").notNull(),
    action: text("action").notNull(), // 'CREATE' or 'UPDATE'
    existingVariantId: uuid("existing_variant_id").references(
      () => productVariants.id,
      {
        onDelete: "cascade",
        onUpdate: "cascade",
      },
    ),

    // Variant fields (mirroring product_variants table)
    id: uuid("id").notNull(), // Planned variant ID for CREATE, existing ID for UPDATE
    productId: uuid("product_id").notNull(),
    colorId: uuid("color_id"),
    sizeId: uuid("size_id"),
    sku: text("sku"),
    ean: text("ean"), // EAN barcode
    upid: text("upid").notNull(),
    productImageUrl: text("product_image_url"),
    status: text("status"), // draft|published|archived
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Indexes for performance
    index("staging_product_variants_job_id_idx").on(table.jobId),
    index("staging_product_variants_staging_product_id_idx").on(
      table.stagingProductId,
    ),
    index("staging_product_variants_action_idx").on(table.action),
    index("staging_product_variants_existing_variant_id_idx").on(
      table.existingVariantId,
    ),
    index("staging_product_variants_upid_idx").on(table.upid),
    uniqueIndex("staging_product_variants_job_row_unq").on(
      table.jobId,
      table.rowNumber,
    ),

    // RLS policies - access through import_jobs brand ownership
    pgPolicy("staging_product_variants_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_product_variants_insert_by_system", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_product_variants_update_by_system", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_product_variants_delete_by_system", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
  ],
);

/**
 * Staging junction table for product materials during bulk import
 * Links staged products to materials with composition percentages
 */
export const stagingProductMaterials = pgTable(
  "staging_product_materials",
  {
    stagingId: uuid("staging_id").defaultRandom().primaryKey().notNull(),
    stagingProductId: uuid("staging_product_id")
      .references(() => stagingProducts.stagingId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    jobId: uuid("job_id")
      .references(() => importJobs.id, {
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
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Indexes for performance
    index("staging_product_materials_job_id_idx").on(table.jobId),
    index("staging_product_materials_staging_product_id_idx").on(
      table.stagingProductId,
    ),
    uniqueIndex("staging_product_materials_unique").on(
      table.stagingProductId,
      table.brandMaterialId,
    ),

    // RLS policies - access through import_jobs brand ownership
    pgPolicy("staging_product_materials_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_product_materials_insert_by_system", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_product_materials_update_by_system", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_product_materials_delete_by_system", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
  ],
);

/**
 * Staging junction table for product care codes during bulk import
 * Links staged products to care code instructions
 */
export const stagingProductCareCodes = pgTable(
  "staging_product_care_codes",
  {
    stagingId: uuid("staging_id").defaultRandom().primaryKey().notNull(),
    stagingProductId: uuid("staging_product_id")
      .references(() => stagingProducts.stagingId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    jobId: uuid("job_id")
      .references(() => importJobs.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    careCodeId: uuid("care_code_id")
      .references(() => careCodes.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Indexes for performance
    index("staging_product_care_codes_job_id_idx").on(table.jobId),
    index("staging_product_care_codes_staging_product_id_idx").on(
      table.stagingProductId,
    ),
    uniqueIndex("staging_product_care_codes_unique").on(
      table.stagingProductId,
      table.careCodeId,
    ),

    // RLS policies - access through import_jobs brand ownership
    pgPolicy("staging_product_care_codes_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_product_care_codes_insert_by_system", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_product_care_codes_update_by_system", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_product_care_codes_delete_by_system", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
  ],
);

/**
 * Staging junction table for product eco claims during bulk import
 * Links staged products to sustainability claims
 */
export const stagingProductEcoClaims = pgTable(
  "staging_product_eco_claims",
  {
    stagingId: uuid("staging_id").defaultRandom().primaryKey().notNull(),
    stagingProductId: uuid("staging_product_id")
      .references(() => stagingProducts.stagingId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    jobId: uuid("job_id")
      .references(() => importJobs.id, {
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
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Indexes for performance
    index("staging_product_eco_claims_job_id_idx").on(table.jobId),
    index("staging_product_eco_claims_staging_product_id_idx").on(
      table.stagingProductId,
    ),
    uniqueIndex("staging_product_eco_claims_unique").on(
      table.stagingProductId,
      table.ecoClaimId,
    ),

    // RLS policies - access through import_jobs brand ownership
    pgPolicy("staging_product_eco_claims_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_product_eco_claims_insert_by_system", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_product_eco_claims_update_by_system", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_product_eco_claims_delete_by_system", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
  ],
);

/**
 * Staging junction table for product journey steps during bulk import
 * Tracks supply chain traceability through facilities
 */
export const stagingProductJourneySteps = pgTable(
  "staging_product_journey_steps",
  {
    stagingId: uuid("staging_id").defaultRandom().primaryKey().notNull(),
    stagingProductId: uuid("staging_product_id")
      .references(() => stagingProducts.stagingId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    jobId: uuid("job_id")
      .references(() => importJobs.id, {
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
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Indexes for performance
    index("staging_product_journey_steps_job_id_idx").on(table.jobId),
    index("staging_product_journey_steps_staging_product_id_idx").on(
      table.stagingProductId,
    ),
    uniqueIndex("staging_product_journey_steps_unique").on(
      table.stagingProductId,
      table.sortIndex,
    ),

    // RLS policies - access through import_jobs brand ownership
    pgPolicy("staging_product_journey_steps_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_product_journey_steps_insert_by_system", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_product_journey_steps_update_by_system", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_product_journey_steps_delete_by_system", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
  ],
);

/**
 * Staging table for product environment data during bulk import
 * Stores carbon footprint and water usage metrics
 */
export const stagingProductEnvironment = pgTable(
  "staging_product_environment",
  {
    stagingId: uuid("staging_id").defaultRandom().primaryKey().notNull(),
    stagingProductId: uuid("staging_product_id")
      .references(() => stagingProducts.stagingId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    jobId: uuid("job_id")
      .references(() => importJobs.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    carbonKgCo2e: numeric("carbon_kg_co2e", { precision: 6, scale: 4 }),
    waterLiters: numeric("water_liters", { precision: 6, scale: 4 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Indexes for performance
    index("staging_product_environment_job_id_idx").on(table.jobId),
    index("staging_product_environment_staging_product_id_idx").on(
      table.stagingProductId,
    ),
    uniqueIndex("staging_product_environment_unique").on(
      table.stagingProductId,
    ),

    // RLS policies - access through import_jobs brand ownership
    pgPolicy("staging_product_environment_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_product_environment_insert_by_system", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_product_environment_update_by_system", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_product_environment_delete_by_system", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
  ],
);

/**
 * Staging table for product identifiers during bulk import
 * Stores EAN, UPC, GTIN and other product identification codes
 */
export const stagingProductIdentifiers = pgTable(
  "staging_product_identifiers",
  {
    stagingId: uuid("staging_id").defaultRandom().primaryKey().notNull(),
    stagingProductId: uuid("staging_product_id")
      .references(() => stagingProducts.stagingId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    jobId: uuid("job_id")
      .references(() => importJobs.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    idType: text("id_type").notNull(),
    value: text("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Indexes for performance
    index("staging_product_identifiers_job_id_idx").on(table.jobId),
    index("staging_product_identifiers_staging_product_id_idx").on(
      table.stagingProductId,
    ),
    uniqueIndex("staging_product_identifiers_unique").on(
      table.stagingProductId,
      table.idType,
      table.value,
    ),

    // RLS policies - access through import_jobs brand ownership
    pgPolicy("staging_product_identifiers_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_product_identifiers_insert_by_system", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_product_identifiers_update_by_system", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_product_identifiers_delete_by_system", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
  ],
);

/**
 * Staging table for product variant identifiers during bulk import
 * Stores variant-specific barcodes and identification codes
 */
export const stagingProductVariantIdentifiers = pgTable(
  "staging_product_variant_identifiers",
  {
    stagingId: uuid("staging_id").defaultRandom().primaryKey().notNull(),
    stagingVariantId: uuid("staging_variant_id")
      .references(() => stagingProductVariants.stagingId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    jobId: uuid("job_id")
      .references(() => importJobs.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    idType: text("id_type").notNull(),
    value: text("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Indexes for performance
    index("staging_product_variant_identifiers_job_id_idx").on(table.jobId),
    index("staging_product_variant_identifiers_staging_variant_id_idx").on(
      table.stagingVariantId,
    ),
    uniqueIndex("staging_product_variant_identifiers_unique").on(
      table.stagingVariantId,
      table.idType,
      table.value,
    ),

    // RLS policies - access through import_jobs brand ownership
    pgPolicy("staging_product_variant_identifiers_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_product_variant_identifiers_insert_by_system", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_product_variant_identifiers_update_by_system", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_product_variant_identifiers_delete_by_system", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
  ],
);
