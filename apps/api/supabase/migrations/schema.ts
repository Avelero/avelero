import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["owner", "member"]);

export const brands = pgTable(
  "brands",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    countryCode: text("country_code"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    avatarHue: smallint("avatar_hue"),
    logoPath: text("logo_path"),
    email: text(),
  },
  (table) => [
    index("idx_brands_avatar_hue")
      .using("btree", table.avatarHue.asc().nullsLast().op("int2_ops"))
      .where(sql`(avatar_hue IS NOT NULL)`),
    index("idx_brands_email").using(
      "btree",
      table.email.asc().nullsLast().op("text_ops"),
    ),
    pgPolicy("brands_delete_by_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_owner(id)`,
    }),
    pgPolicy("brands_insert_by_authenticated", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("brands_select_for_invite_recipients", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("brands_select_for_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("brands_update_by_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
    check(
      "brands_avatar_hue_check",
      sql`(avatar_hue IS NULL) OR ((avatar_hue >= 1) AND (avatar_hue <= 360))`,
    ),
  ],
);

export const usersOnBrand = pgTable(
  "users_on_brand",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid("user_id").notNull(),
    brandId: uuid("brand_id").notNull(),
    role: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_users_on_brand_brand_id").using(
      "btree",
      table.brandId.asc().nullsLast().op("uuid_ops"),
    ),
    index("idx_users_on_brand_user_id").using(
      "btree",
      table.userId.asc().nullsLast().op("uuid_ops"),
    ),
    uniqueIndex("ux_users_on_brand_user_brand").using(
      "btree",
      table.userId.asc().nullsLast().op("uuid_ops"),
      table.brandId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.brandId],
      foreignColumns: [brands.id],
      name: "users_on_brand_brand_id_brands_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "users_on_brand_user_id_users_id_fk",
    }).onDelete("cascade"),
    unique("users_on_brand_user_id_brand_id_key").on(
      table.userId,
      table.brandId,
    ),
    pgPolicy("users_on_brand_delete_owner_non_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`(is_brand_owner(brand_id) AND ((role <> 'owner'::text) OR (user_id = auth.uid())))`,
    }),
    pgPolicy("users_on_brand_delete_self", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
    }),
    pgPolicy("users_on_brand_insert_first_owner_self", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("users_on_brand_select_for_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("users_on_brand_update_by_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
    check(
      "users_on_brand_role_check",
      sql`role = ANY (ARRAY['owner'::text, 'member'::text])`,
    ),
  ],
);

export const brandInvites = pgTable(
  "brand_invites",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id").notNull(),
    email: text().notNull(),
    role: text().notNull(),
    tokenHash: text("token_hash"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_brand_invites_brand_id").using(
      "btree",
      table.brandId.asc().nullsLast().op("uuid_ops"),
    ),
    index("idx_brand_invites_expires_at").using(
      "btree",
      table.expiresAt.asc().nullsLast().op("timestamptz_ops"),
    ),
    index("idx_brand_invites_token_hash").using(
      "btree",
      table.tokenHash.asc().nullsLast().op("text_ops"),
    ),
    index("idx_brand_invites_valid_lookup").using(
      "btree",
      table.brandId.asc().nullsLast().op("timestamptz_ops"),
      table.expiresAt.asc().nullsLast().op("timestamptz_ops"),
    ),
    uniqueIndex("ux_brand_invites_token_hash_not_null")
      .using("btree", table.tokenHash.asc().nullsLast().op("text_ops"))
      .where(sql`(token_hash IS NOT NULL)`),
    foreignKey({
      columns: [table.brandId],
      foreignColumns: [brands.id],
      name: "brand_invites_brand_id_brands_id_fk",
    }).onDelete("cascade"),
    pgPolicy("brand_invites_delete_by_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_owner(brand_id)`,
    }),
    pgPolicy("brand_invites_delete_by_recipient", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
    }),
    pgPolicy("brand_invites_insert_by_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("brand_invites_select_for_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("brand_invites_select_for_recipient", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("brand_invites_update_by_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
    check(
      "brand_invites_role_check",
      sql`role = ANY (ARRAY['owner'::text, 'member'::text])`,
    ),
  ],
);

export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().notNull(),
    email: text().notNull(),
    fullName: text("full_name"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    brandId: uuid("brand_id"),
    avatarHue: smallint("avatar_hue"),
    avatarPath: text("avatar_path"),
    role: userRole().default("member").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.id],
      foreignColumns: [table.id],
      name: "users_id_users_id_fk",
    }).onDelete("cascade"),
    unique("users_email_key").on(table.email),
    pgPolicy("users_insert_own_profile", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`(auth.uid() = id)`,
    }),
    pgPolicy("users_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("users_select_own_profile", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("users_update_own_profile", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
    check(
      "users_avatar_hue_check",
      sql`(avatar_hue IS NULL) OR ((avatar_hue >= 1) AND (avatar_hue <= 360))`,
    ),
  ],
);

export const passports = pgTable(
  "passports",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id").notNull(),
    productId: uuid("product_id").notNull(),
    templateId: uuid("template_id").notNull(),
    status: varchar().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    variantId: uuid("variant_id").notNull(),
    slug: text().notNull(),
  },
  (table) => [
    uniqueIndex("passports_brand_product_variant_unq").using(
      "btree",
      table.brandId.asc().nullsLast().op("uuid_ops"),
      table.productId.asc().nullsLast().op("uuid_ops"),
      table.variantId.asc().nullsLast().op("uuid_ops"),
    ),
    uniqueIndex("passports_slug_unq").using(
      "btree",
      table.slug.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.brandId],
      foreignColumns: [brands.id],
      name: "passports_brand_id_brands_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [products.id],
      name: "passports_product_id_products_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.templateId],
      foreignColumns: [passportTemplates.id],
      name: "passports_template_id_passport_templates_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.variantId],
      foreignColumns: [productVariants.id],
      name: "passports_variant_id_product_variants_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("passports_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("passports_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("passports_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("passports_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    parentId: uuid("parent_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("categories_parent_id_idx").using(
      "btree",
      table.parentId.asc().nullsLast().op("uuid_ops"),
    ),
    uniqueIndex("categories_parent_name_unq").using(
      "btree",
      table.parentId.asc().nullsLast().op("text_ops"),
      table.name.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: "categories_parent_id_categories_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    pgPolicy("categories_modify_system_only", {
      as: "restrictive",
      for: "all",
      to: ["authenticated"],
      using: sql`false`,
      withCheck: sql`false`,
    }),
    pgPolicy("categories_select_for_authenticated", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
  ],
);

export const brandCertifications = pgTable(
  "brand_certifications",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id").notNull(),
    title: text().notNull(),
    certificationCode: text("certification_code"),
    instituteName: text("institute_name"),
    instituteAddress: text("institute_address"),
    instituteContact: text("institute_contact"),
    issueDate: timestamp("issue_date", { mode: "string" }),
    expiryDate: timestamp("expiry_date", { mode: "string" }),
    fileAssetId: uuid("file_asset_id"),
    externalUrl: text("external_url"),
    notes: text(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.brandId],
      foreignColumns: [brands.id],
      name: "brand_certifications_brand_id_brands_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.fileAssetId],
      foreignColumns: [fileAssets.id],
      name: "brand_certifications_file_asset_id_file_assets_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    pgPolicy("brand_certifications_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_certifications_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("brand_certifications_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("brand_certifications_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
  ],
);

export const brandCollections = pgTable(
  "brand_collections",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id").notNull(),
    name: text().notNull(),
    description: text(),
    filter: jsonb().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("brand_collections_brand_name_unq").using(
      "btree",
      table.brandId.asc().nullsLast().op("text_ops"),
      table.name.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.brandId],
      foreignColumns: [brands.id],
      name: "brand_collections_brand_id_brands_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("brand_collections_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_owner(brand_id)`,
    }),
    pgPolicy("brand_collections_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("brand_collections_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("brand_collections_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
  ],
);

export const passportTemplates = pgTable(
  "passport_templates",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id").notNull(),
    name: text().notNull(),
    theme: jsonb().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.brandId],
      foreignColumns: [brands.id],
      name: "passport_templates_brand_id_brands_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("passport_templates_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("passport_templates_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("passport_templates_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("passport_templates_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
  ],
);

export const passportTemplateModules = pgTable(
  "passport_template_modules",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    templateId: uuid("template_id").notNull(),
    moduleKey: text("module_key").notNull(),
    enabled: boolean().default(true).notNull(),
    sortIndex: integer("sort_index").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("passport_template_modules_template_module_unq").using(
      "btree",
      table.templateId.asc().nullsLast().op("text_ops"),
      table.moduleKey.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.templateId],
      foreignColumns: [passportTemplates.id],
      name: "passport_template_modules_template_id_passport_templates_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("passport_template_modules_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_member(( SELECT passport_templates.brand_id
   FROM passport_templates
  WHERE (passport_templates.id = passport_template_modules.template_id)))`,
    }),
    pgPolicy("passport_template_modules_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("passport_template_modules_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("passport_template_modules_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
  ],
);

export const passportModuleCompletion = pgTable(
  "passport_module_completion",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    passportId: uuid("passport_id").notNull(),
    moduleKey: text("module_key").notNull(),
    isCompleted: boolean("is_completed").default(false).notNull(),
    lastEvaluatedAt: timestamp("last_evaluated_at", {
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
    index("passport_module_completion_module_completed_idx").using(
      "btree",
      table.moduleKey.asc().nullsLast().op("text_ops"),
      table.isCompleted.asc().nullsLast().op("bool_ops"),
    ),
    index("passport_module_completion_passport_id_idx").using(
      "btree",
      table.passportId.asc().nullsLast().op("uuid_ops"),
    ),
    uniqueIndex("passport_module_completion_passport_module_unq").using(
      "btree",
      table.passportId.asc().nullsLast().op("uuid_ops"),
      table.moduleKey.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.passportId],
      foreignColumns: [passports.id],
      name: "passport_module_completion_passport_id_passports_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("passport_module_completion_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_member(( SELECT passports.brand_id
   FROM passports
  WHERE (passports.id = passport_module_completion.passport_id)))`,
    }),
    pgPolicy("passport_module_completion_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("passport_module_completion_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("passport_module_completion_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
  ],
);

export const brandColors = pgTable(
  "brand_colors",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id").notNull(),
    name: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("brand_colors_brand_name_unq").using(
      "btree",
      table.brandId.asc().nullsLast().op("text_ops"),
      table.name.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.brandId],
      foreignColumns: [brands.id],
      name: "brand_colors_brand_id_brands_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("brand_colors_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_colors_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("brand_colors_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("brand_colors_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
  ],
);

export const brandEcoClaims = pgTable(
  "brand_eco_claims",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id").notNull(),
    claim: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("brand_eco_claims_brand_claim_unq").using(
      "btree",
      table.brandId.asc().nullsLast().op("text_ops"),
      table.claim.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.brandId],
      foreignColumns: [brands.id],
      name: "brand_eco_claims_brand_id_brands_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("brand_eco_claims_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_eco_claims_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("brand_eco_claims_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("brand_eco_claims_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
  ],
);

export const brandFacilities = pgTable(
  "brand_facilities",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id").notNull(),
    displayName: text("display_name").notNull(),
    legalName: text("legal_name"),
    address: text(),
    city: text(),
    countryCode: text("country_code"),
    contact: text(),
    vatNumber: text("vat_number"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.brandId],
      foreignColumns: [brands.id],
      name: "brand_facilities_brand_id_brands_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("brand_facilities_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_facilities_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("brand_facilities_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("brand_facilities_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
  ],
);

export const brandMaterials = pgTable(
  "brand_materials",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id").notNull(),
    name: text().notNull(),
    certificationId: uuid("certification_id"),
    recyclable: boolean(),
    countryOfOrigin: text("country_of_origin"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.brandId],
      foreignColumns: [brands.id],
      name: "brand_materials_brand_id_brands_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.certificationId],
      foreignColumns: [brandCertifications.id],
      name: "brand_materials_certification_id_brand_certifications_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    pgPolicy("brand_materials_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_materials_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("brand_materials_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("brand_materials_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
  ],
);

export const brandServices = pgTable(
  "brand_services",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id").notNull(),
    name: text().notNull(),
    description: text(),
    serviceUrl: text("service_url"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("brand_services_brand_name_unq").using(
      "btree",
      table.brandId.asc().nullsLast().op("text_ops"),
      table.name.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.brandId],
      foreignColumns: [brands.id],
      name: "brand_services_brand_id_brands_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("brand_services_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_owner(brand_id)`,
    }),
    pgPolicy("brand_services_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("brand_services_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("brand_services_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
  ],
);

export const brandSizes = pgTable(
  "brand_sizes",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id").notNull(),
    name: text().notNull(),
    sortIndex: integer("sort_index"),
    categoryId: uuid("category_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("brand_sizes_brand_name_unq").using(
      "btree",
      table.brandId.asc().nullsLast().op("uuid_ops"),
      table.name.asc().nullsLast().op("text_ops"),
      table.categoryId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.brandId],
      foreignColumns: [brands.id],
      name: "brand_sizes_brand_id_brands_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.categoryId],
      foreignColumns: [categories.id],
      name: "brand_sizes_category_id_categories_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    pgPolicy("brand_sizes_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_sizes_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("brand_sizes_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("brand_sizes_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
  ],
);

export const careCodes = pgTable(
  "care_codes",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    code: text().notNull(),
    name: text().notNull(),
    description: text(),
    iconUrl: text("icon_url"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("care_codes_code_unq").using(
      "btree",
      table.code.asc().nullsLast().op("text_ops"),
    ),
    pgPolicy("care_codes_modify_system_only", {
      as: "restrictive",
      for: "all",
      to: ["authenticated"],
      using: sql`false`,
      withCheck: sql`false`,
    }),
    pgPolicy("care_codes_select_for_authenticated", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
  ],
);

export const showcaseBrands = pgTable(
  "showcase_brands",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id").notNull(),
    name: text().notNull(),
    legalName: text("legal_name"),
    email: text(),
    phone: text(),
    website: text(),
    addressLine1: text("address_line_1"),
    addressLine2: text("address_line_2"),
    city: text(),
    state: text(),
    zip: text(),
    countryCode: text("country_code"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("showcase_brands_brand_name_unq").using(
      "btree",
      table.brandId.asc().nullsLast().op("text_ops"),
      table.name.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.brandId],
      foreignColumns: [brands.id],
      name: "showcase_brands_brand_id_brands_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("showcase_brands_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_owner(brand_id)`,
    }),
    pgPolicy("showcase_brands_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("showcase_brands_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("showcase_brands_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id").notNull(),
    name: text().notNull(),
    description: text(),
    showcaseBrandId: uuid("showcase_brand_id"),
    primaryImageUrl: text("primary_image_url"),
    categoryId: uuid("category_id"),
    season: text(),
    brandCertificationId: uuid("brand_certification_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_products_brand_category").using(
      "btree",
      table.brandId.asc().nullsLast().op("uuid_ops"),
      table.categoryId.asc().nullsLast().op("uuid_ops"),
    ),
    index("idx_products_brand_category_season").using(
      "btree",
      table.brandId.asc().nullsLast().op("uuid_ops"),
      table.categoryId.asc().nullsLast().op("uuid_ops"),
      table.season.asc().nullsLast().op("uuid_ops"),
    ),
    index("idx_products_brand_created_at").using(
      "btree",
      table.brandId.asc().nullsLast().op("timestamptz_ops"),
      table.createdAt.asc().nullsLast().op("uuid_ops"),
    ),
    index("idx_products_brand_name").using(
      "btree",
      table.brandId.asc().nullsLast().op("text_ops"),
      table.name.asc().nullsLast().op("uuid_ops"),
    ),
    index("idx_products_brand_season").using(
      "btree",
      table.brandId.asc().nullsLast().op("text_ops"),
      table.season.asc().nullsLast().op("text_ops"),
    ),
    index("idx_products_cursor_pagination").using(
      "btree",
      table.createdAt.desc().nullsFirst().op("timestamptz_ops"),
      table.id.desc().nullsFirst().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.brandCertificationId],
      foreignColumns: [brandCertifications.id],
      name: "products_brand_certification_id_brand_certifications_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    foreignKey({
      columns: [table.brandId],
      foreignColumns: [brands.id],
      name: "products_brand_id_brands_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.categoryId],
      foreignColumns: [categories.id],
      name: "products_category_id_categories_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    foreignKey({
      columns: [table.showcaseBrandId],
      foreignColumns: [showcaseBrands.id],
      name: "products_showcase_brand_id_showcase_brands_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    pgPolicy("products_delete_by_brand_members", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("products_insert_by_brand_members", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("products_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("products_update_by_brand_members", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
  ],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    productId: uuid("product_id").notNull(),
    colorId: uuid("color_id"),
    sizeId: uuid("size_id"),
    sku: text(),
    upid: text().notNull(),
    productImageUrl: text("product_image_url"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.colorId],
      foreignColumns: [brandColors.id],
      name: "product_variants_color_id_brand_colors_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [products.id],
      name: "product_variants_product_id_products_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.sizeId],
      foreignColumns: [brandSizes.id],
      name: "product_variants_size_id_brand_sizes_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    pgPolicy("product_variants_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`(EXISTS ( SELECT 1
   FROM products
  WHERE ((products.id = product_variants.product_id) AND is_brand_member(products.brand_id))))`,
    }),
    pgPolicy("product_variants_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("product_variants_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("product_variants_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
  ],
);

export const productMaterials = pgTable(
  "product_materials",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    productId: uuid("product_id").notNull(),
    brandMaterialId: uuid("brand_material_id").notNull(),
    percentage: numeric({ precision: 6, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("product_materials_product_material_unq").using(
      "btree",
      table.productId.asc().nullsLast().op("uuid_ops"),
      table.brandMaterialId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.brandMaterialId],
      foreignColumns: [brandMaterials.id],
      name: "product_materials_brand_material_id_brand_materials_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [products.id],
      name: "product_materials_product_id_products_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("product_materials_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`(EXISTS ( SELECT 1
   FROM products
  WHERE ((products.id = product_materials.product_id) AND is_brand_member(products.brand_id))))`,
    }),
    pgPolicy("product_materials_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("product_materials_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("product_materials_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
  ],
);

export const productJourneySteps = pgTable(
  "product_journey_steps",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    productId: uuid("product_id").notNull(),
    sortIndex: integer("sort_index").notNull(),
    stepType: text("step_type").notNull(),
    facilityId: uuid("facility_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("product_journey_steps_product_sort_unq").using(
      "btree",
      table.productId.asc().nullsLast().op("int4_ops"),
      table.sortIndex.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.facilityId],
      foreignColumns: [brandFacilities.id],
      name: "product_journey_steps_facility_id_brand_facilities_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [products.id],
      name: "product_journey_steps_product_id_products_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("product_journey_steps_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`(EXISTS ( SELECT 1
   FROM products
  WHERE ((products.id = product_journey_steps.product_id) AND is_brand_member(products.brand_id))))`,
    }),
    pgPolicy("product_journey_steps_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("product_journey_steps_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("product_journey_steps_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
  ],
);

export const productEnvironment = pgTable(
  "product_environment",
  {
    productId: uuid("product_id").primaryKey().notNull(),
    carbonKgCo2E: numeric("carbon_kg_co2e", { precision: 6, scale: 4 }),
    waterLiters: numeric("water_liters", { precision: 6, scale: 4 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.productId],
      foreignColumns: [products.id],
      name: "product_environment_product_id_products_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("product_environment_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`(EXISTS ( SELECT 1
   FROM products
  WHERE ((products.id = product_environment.product_id) AND is_brand_member(products.brand_id))))`,
    }),
    pgPolicy("product_environment_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("product_environment_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("product_environment_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
  ],
);

export const productIdentifiers = pgTable(
  "product_identifiers",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    productId: uuid("product_id").notNull(),
    idType: text("id_type").notNull(),
    value: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("product_identifiers_product_type_value_unq").using(
      "btree",
      table.productId.asc().nullsLast().op("text_ops"),
      table.idType.asc().nullsLast().op("text_ops"),
      table.value.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [products.id],
      name: "product_identifiers_product_id_products_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("product_identifiers_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`(EXISTS ( SELECT 1
   FROM products
  WHERE ((products.id = product_identifiers.product_id) AND is_brand_member(products.brand_id))))`,
    }),
    pgPolicy("product_identifiers_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("product_identifiers_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("product_identifiers_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
  ],
);

export const productVariantIdentifiers = pgTable(
  "product_variant_identifiers",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    variantId: uuid("variant_id").notNull(),
    idType: text("id_type").notNull(),
    value: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("product_variant_identifiers_product_type_value_unq").using(
      "btree",
      table.variantId.asc().nullsLast().op("text_ops"),
      table.idType.asc().nullsLast().op("text_ops"),
      table.value.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.variantId],
      foreignColumns: [productVariants.id],
      name: "product_variant_identifiers_variant_id_product_variants_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("product_variant_identifiers_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`(EXISTS ( SELECT 1
   FROM (product_variants
     JOIN products ON ((products.id = product_variants.product_id)))
  WHERE ((product_variants.id = product_variant_identifiers.variant_id) AND is_brand_member(products.brand_id))))`,
    }),
    pgPolicy("product_variant_identifiers_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("product_variant_identifiers_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("product_variant_identifiers_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
  ],
);

export const productEcoClaims = pgTable(
  "product_eco_claims",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    productId: uuid("product_id").notNull(),
    ecoClaimId: uuid("eco_claim_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("product_eco_claims_unique").using(
      "btree",
      table.productId.asc().nullsLast().op("uuid_ops"),
      table.ecoClaimId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.ecoClaimId],
      foreignColumns: [brandEcoClaims.id],
      name: "product_eco_claims_eco_claim_id_brand_eco_claims_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [products.id],
      name: "product_eco_claims_product_id_products_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("product_eco_claims_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`(EXISTS ( SELECT 1
   FROM products
  WHERE ((products.id = product_eco_claims.product_id) AND is_brand_member(products.brand_id))))`,
    }),
    pgPolicy("product_eco_claims_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("product_eco_claims_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("product_eco_claims_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
  ],
);

export const productCareCodes = pgTable(
  "product_care_codes",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    productId: uuid("product_id").notNull(),
    careCodeId: uuid("care_code_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("product_care_codes_unique").using(
      "btree",
      table.productId.asc().nullsLast().op("uuid_ops"),
      table.careCodeId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.careCodeId],
      foreignColumns: [careCodes.id],
      name: "product_care_codes_care_code_id_care_codes_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [products.id],
      name: "product_care_codes_product_id_products_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("product_care_codes_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`(EXISTS ( SELECT 1
   FROM products
  WHERE ((products.id = product_care_codes.product_id) AND is_brand_member(products.brand_id))))`,
    }),
    pgPolicy("product_care_codes_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("product_care_codes_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("product_care_codes_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
  ],
);

export const fileAssets = pgTable(
  "file_assets",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id"),
    bucket: text().notNull(),
    path: text().notNull(),
    mimeType: text("mime_type"),
    bytes: integer(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("file_assets_bucket_path_unq").using(
      "btree",
      table.bucket.asc().nullsLast().op("text_ops"),
      table.path.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.brandId],
      foreignColumns: [brands.id],
      name: "file_assets_brand_id_brands_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("file_assets_delete_by_brand_owner_or_system", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`((brand_id IS NULL) OR is_brand_owner(brand_id))`,
    }),
    pgPolicy("file_assets_insert_by_brand_owner_or_system", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("file_assets_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("file_assets_update_by_brand_owner_or_system", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
  ],
);

export const importJobs = pgTable(
  "import_jobs",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id").notNull(),
    filename: text().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", {
      withTimezone: true,
      mode: "string",
    }),
    status: text().default("PENDING").notNull(),
    summary: jsonb(),
  },
  (table) => [
    foreignKey({
      columns: [table.brandId],
      foreignColumns: [brands.id],
      name: "import_jobs_brand_id_brands_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("import_jobs_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_owner(brand_id)`,
    }),
    pgPolicy("import_jobs_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("import_jobs_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("import_jobs_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
  ],
);

export const importRows = pgTable(
  "import_rows",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    jobId: uuid("job_id").notNull(),
    rowNumber: integer("row_number").notNull(),
    raw: jsonb().notNull(),
    normalized: jsonb(),
    error: text(),
    status: text().default("PENDING").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("import_rows_job_row_unq").using(
      "btree",
      table.jobId.asc().nullsLast().op("int4_ops"),
      table.rowNumber.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.jobId],
      foreignColumns: [importJobs.id],
      name: "import_rows_job_id_import_jobs_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("import_rows_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`(EXISTS ( SELECT 1
   FROM import_jobs
  WHERE ((import_jobs.id = import_rows.job_id) AND is_brand_owner(import_jobs.brand_id))))`,
    }),
    pgPolicy("import_rows_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("import_rows_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("import_rows_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
  ],
);

export const valueMappings = pgTable(
  "value_mappings",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id").notNull(),
    sourceColumn: text("source_column").notNull(),
    rawValue: text("raw_value").notNull(),
    target: text().notNull(),
    targetId: uuid("target_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("value_mappings_brand_col_raw_unq").using(
      "btree",
      table.brandId.asc().nullsLast().op("uuid_ops"),
      table.sourceColumn.asc().nullsLast().op("text_ops"),
      table.rawValue.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.brandId],
      foreignColumns: [brands.id],
      name: "value_mappings_brand_id_brands_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("value_mappings_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_owner(brand_id)`,
    }),
    pgPolicy("value_mappings_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("value_mappings_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("value_mappings_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
  ],
);
