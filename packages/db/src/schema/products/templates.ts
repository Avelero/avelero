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

// Template status enum
export const templateStatusEnum = [
  "draft",
  "published",
  "archived",
  "disabled",
] as const;
export type TemplateStatus = (typeof templateStatusEnum)[number];

// Template type enum
export const templateTypeEnum = ["passport", "product", "custom"] as const;
export type TemplateType = (typeof templateTypeEnum)[number];

export const templates = pgTable(
  "templates",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id")
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),

    // Template metadata
    name: text("name").notNull(),
    description: text("description"),
    templateType: text("template_type").notNull().default("passport"),
    templateStatus: text("template_status").notNull().default("draft"),

    // Template configuration
    config: jsonb("config").default({}).notNull(),
    moduleIds: jsonb("module_ids").default([]).notNull(), // Array of module IDs this template uses
    requiredFields: jsonb("required_fields").default([]).notNull(),
    optionalFields: jsonb("optional_fields").default([]).notNull(),

    // Template behavior
    enabled: boolean("enabled").default(true).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    allowCustomization: boolean("allow_customization").default(true).notNull(),

    // Versioning
    version: text("version").default("1.0").notNull(),
    versionNotes: text("version_notes"),
    parentTemplateId: uuid("parent_template_id"), // For template versions/forks

    // Usage tracking
    usageCount: integer("usage_count").default(0).notNull(),
    lastUsedAt: timestamp("last_used_at", {
      withTimezone: true,
      mode: "string",
    }),

    // Validation
    validationRules: jsonb("validation_rules").default({}).notNull(),
    validationScore: integer("validation_score").default(0),

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
    brandTypeIdx: index("templates_brand_type_idx").on(
      table.brandId,
      table.templateType,
    ),
    brandStatusIdx: index("templates_brand_status_idx").on(
      table.brandId,
      table.templateStatus,
    ),
    brandEnabledIdx: index("templates_brand_enabled_idx").on(
      table.brandId,
      table.enabled,
    ),
    brandCreatedIdx: index("templates_brand_created_idx").on(
      table.brandId,
      table.createdAt,
    ),

    // Template search and filtering indexes
    nameSearchIdx: index("templates_name_search_idx").on(table.name),
    templateTypeIdx: index("templates_type_idx").on(table.templateType),
    templateStatusIdx: index("templates_status_idx").on(table.templateStatus),
    enabledIdx: index("templates_enabled_idx").on(table.enabled),
    isDefaultIdx: index("templates_is_default_idx").on(table.isDefault),

    // Template hierarchy and versioning
    parentTemplateIdx: index("templates_parent_template_idx").on(
      table.parentTemplateId,
    ),
    versionIdx: index("templates_version_idx").on(table.version),

    // Usage tracking indexes
    usageCountIdx: index("templates_usage_count_idx").on(table.usageCount),
    lastUsedAtIdx: index("templates_last_used_at_idx").on(table.lastUsedAt),

    // Validation indexes
    validationScoreIdx: index("templates_validation_score_idx").on(
      table.validationScore,
    ),

    // Language indexes
    primaryLanguageIdx: index("templates_primary_language_idx").on(
      table.primaryLanguage,
    ),

    // Temporal indexes for cursor pagination
    updatedAtIdx: index("templates_updated_at_idx").on(table.updatedAt),

    // RLS policies for brand isolation
    templatesSelectForBrandMembers: pgPolicy(
      "templates_select_for_brand_members",
      {
        as: "permissive",
        for: "select",
        to: ["authenticated"],
        using: sql`is_brand_member(brand_id)`,
      },
    ),
    templatesInsertByBrandOwner: pgPolicy("templates_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`is_brand_member(brand_id)`,
    }),
    templatesUpdateByBrandOwner: pgPolicy("templates_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
    templatesDeleteByBrandOwner: pgPolicy("templates_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
  }),
);

export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;
