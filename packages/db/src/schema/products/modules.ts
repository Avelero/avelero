import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  boolean,
  integer,
  pgPolicy,
  index,
} from "drizzle-orm/pg-core";
import { brands } from "../core/brands";

// Module status enum
export const moduleStatusEnum = [
  "draft",
  "published",
  "archived",
  "disabled",
] as const;
export type ModuleStatus = (typeof moduleStatusEnum)[number];

// Module type enum
export const moduleTypeEnum = [
  "data_collection",
  "validation",
  "compliance",
  "reporting",
  "custom",
] as const;
export type ModuleType = (typeof moduleTypeEnum)[number];

export const modules = pgTable(
  "modules",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id")
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),

    // Module metadata
    name: text("name").notNull(),
    description: text("description"),
    moduleType: text("module_type").notNull().default("data_collection"),
    moduleStatus: text("module_status").notNull().default("draft"),

    // Module configuration
    config: jsonb("config").default({}).notNull(),
    fieldDefinitions: jsonb("field_definitions").default([]).notNull(),
    validationRules: jsonb("validation_rules").default({}).notNull(),
    displaySettings: jsonb("display_settings").default({}).notNull(),

    // Module behavior
    enabled: boolean("enabled").default(true).notNull(),
    required: boolean("required").default(false).notNull(),
    allowMultiple: boolean("allow_multiple").default(false).notNull(),
    isSystem: boolean("is_system").default(false).notNull(), // System modules can't be deleted

    // Dependencies
    dependsOnModules: jsonb("depends_on_modules").default([]).notNull(), // Array of module IDs
    compatibleWith: jsonb("compatible_with").default([]).notNull(), // Compatible module types

    // Versioning
    version: text("version").default("1.0").notNull(),
    versionNotes: text("version_notes"),
    parentModuleId: uuid("parent_module_id"), // For module versions/forks

    // Usage tracking
    usageCount: integer("usage_count").default(0).notNull(),
    lastUsedAt: timestamp("last_used_at", {
      withTimezone: true,
      mode: "string",
    }),

    // Scoring and weights
    completionWeight: integer("completion_weight").default(1).notNull(), // Weight for completion calculations
    validationScore: integer("validation_score").default(0),
    complianceImpact: integer("compliance_impact").default(0), // How much this module affects compliance

    // Localization
    primaryLanguage: text("primary_language").default("en").notNull(),
    availableLanguages: jsonb("available_languages").default(["en"]).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Performance indexes for brand-scoped queries
    brandTypeIdx: index("modules_brand_type_idx").on(
      table.brandId,
      table.moduleType,
    ),
    brandStatusIdx: index("modules_brand_status_idx").on(
      table.brandId,
      table.moduleStatus,
    ),
    brandEnabledIdx: index("modules_brand_enabled_idx").on(
      table.brandId,
      table.enabled,
    ),
    brandCreatedIdx: index("modules_brand_created_idx").on(
      table.brandId,
      table.createdAt,
    ),

    // Module search and filtering indexes
    nameSearchIdx: index("modules_name_search_idx").on(table.name),
    moduleTypeIdx: index("modules_type_idx").on(table.moduleType),
    moduleStatusIdx: index("modules_status_idx").on(table.moduleStatus),
    enabledIdx: index("modules_enabled_idx").on(table.enabled),
    requiredIdx: index("modules_required_idx").on(table.required),
    systemIdx: index("modules_system_idx").on(table.isSystem),

    // Module hierarchy and dependencies
    parentModuleIdx: index("modules_parent_module_idx").on(
      table.parentModuleId,
    ),

    // Usage tracking indexes
    usageCountIdx: index("modules_usage_count_idx").on(table.usageCount),
    lastUsedAtIdx: index("modules_last_used_at_idx").on(table.lastUsedAt),

    // Scoring indexes
    validationScoreIdx: index("modules_validation_score_idx").on(
      table.validationScore,
    ),
    complianceImpactIdx: index("modules_compliance_impact_idx").on(
      table.complianceImpact,
    ),
    completionWeightIdx: index("modules_completion_weight_idx").on(
      table.completionWeight,
    ),

    // Version and language indexes
    versionIdx: index("modules_version_idx").on(table.version),
    primaryLanguageIdx: index("modules_primary_language_idx").on(
      table.primaryLanguage,
    ),

    // Temporal indexes for cursor pagination
    updatedAtIdx: index("modules_updated_at_idx").on(table.updatedAt),

    // RLS policies for brand isolation
    modulesSelectForBrandMembers: pgPolicy("modules_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
    modulesInsertByBrandOwner: pgPolicy("modules_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`is_brand_member(brand_id)`,
    }),
    modulesUpdateByBrandOwner: pgPolicy("modules_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
    modulesDeleteByBrandOwner: pgPolicy("modules_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
  }),
);

export type Module = typeof modules.$inferSelect;
export type NewModule = typeof modules.$inferInsert;
