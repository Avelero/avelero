// Core schemas
export * from "./core/users";
export * from "./core/brands";
export * from "./core/platform-admin-audit-logs";
export * from "./core/platform-admin-allowlist";

// Brand schemas
export * from "./brands/brand-collections";
export * from "./brands/brand-members";
export * from "./brands/brand-invites";
export * from "./brands/brand-tags";
export * from "./brands/brand-theme";
export * from "./brands/brand-custom-domains";
export * from "./brands/brand-lifecycle";
export * from "./brands/brand-plan";
export * from "./brands/brand-billing";
export * from "./brands/brand-billing-events";

// Catalog schemas
export * from "./catalog/brand-attributes";
export * from "./catalog/brand-attribute-values";
export * from "./catalog/brand-certifications";
export * from "./catalog/brand-operators";
export * from "./catalog/brand-manufacturers";
export * from "./catalog/brand-materials";
export * from "./catalog/brand-seasons";

// Product schemas
export * from "./products/products";
export * from "./products/product-variants";
export * from "./products/product-materials";
export * from "./products/product-journey-steps";
export * from "./products/product-environment";
export * from "./products/product-tags";
export * from "./products/product-variant-attributes";
export * from "./products/product-weight";
export * from "./products/product-commercial";

// Variant override tables (for multi-source integration support)
export * from "./products/variant-commercial";
export * from "./products/variant-environment";
export * from "./products/variant-materials";
export * from "./products/variant-weight";
export * from "./products/variant-journey-steps";

// Publishing layer schemas (immutable passport versions)
export * from "./products/product-passports";
export * from "./products/product-passport-versions";

// Data schemas
export * from "./data/file-assets";
export * from "./data/import-jobs";
export * from "./data/import-rows";
export * from "./data/export-jobs";
export * from "./data/qr-export-jobs";
export * from "./data/user-notifications";

// Import schemas
export * from "./import/value-mappings";

// Integration schemas
export * from "./integrations/brand-integrations";
export * from "./integrations/field-configs";
export * from "./integrations/integrations";
export * from "./integrations/oauth-states";
export * from "./integrations/pending-installations";
export * from "./integrations/sync-jobs";
export * from "./integrations/promotion-operations";
export * from "./integrations/links/entity-links";
export * from "./integrations/links/product-links";
export * from "./integrations/links/variant-links";
export * from "./integrations/stripe-webhook-events";

// Taxonomy schemas
export * from "./taxonomy/taxonomy-categories";
export * from "./taxonomy/taxonomy-attributes";
export * from "./taxonomy/taxonomy-values";
export * from "./taxonomy/taxonomy-external-mappings";
