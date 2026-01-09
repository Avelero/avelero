// Core schemas
export * from "./core/users";
export * from "./core/brands";

// Brand schemas
export * from "./brands/brand-collections";
export * from "./brands/brand-members";
export * from "./brands/brand-invites";
export * from "./brands/brand-tags";
export * from "./brands/brand-theme";

// Catalog schemas
export * from "./catalog/brand-attributes";
export * from "./catalog/brand-attribute-values";
export * from "./catalog/brand-certifications";
export * from "./catalog/brand-eco-claims";
export * from "./catalog/brand-facilities";
export * from "./catalog/brand-manufacturers";
export * from "./catalog/brand-materials";
export * from "./catalog/brand-seasons";

// Product schemas
export * from "./products/products";
export * from "./products/product-variants";
export * from "./products/product-materials";
export * from "./products/product-journey-steps";
export * from "./products/product-environment";
export * from "./products/product-eco-claims";
export * from "./products/product-tags";
export * from "./products/product-variant-attributes";
export * from "./products/product-weight";
export * from "./products/product-commercial";

// Variant override tables (for multi-source integration support)
export * from "./products/variant-commercial";
export * from "./products/variant-environment";
export * from "./products/variant-eco-claims";
export * from "./products/variant-materials";
export * from "./products/variant-weight";
export * from "./products/variant-journey-steps";

// Data schemas
export * from "./data/file-assets";
export * from "./data/import-jobs";
export * from "./data/import-rows";

// Staging schemas
export * from "./staging/staging-products";
export * from "./staging/staging-product-variants";
export * from "./staging/staging-product-materials";
export * from "./staging/staging-product-journey-steps";
export * from "./staging/staging-product-environment";
export * from "./staging/staging-eco-claims";
export * from "./staging/value-mappings";
// New staging schemas for bulk import refactor
export * from "./staging/staging-variant-attributes";
export * from "./staging/staging-product-tags";
export * from "./staging/staging-product-weight";
export * from "./staging/staging-variant-materials";
export * from "./staging/staging-variant-eco-claims";
export * from "./staging/staging-variant-environment";
export * from "./staging/staging-variant-journey-steps";
export * from "./staging/staging-variant-weight";

// Integration schemas
export * from "./integrations/brand-integrations";
export * from "./integrations/field-configs";
export * from "./integrations/integrations";
export * from "./integrations/oauth-states";
export * from "./integrations/sync-jobs";
export * from "./integrations/promotion-operations";
export * from "./integrations/links/entity-links";
export * from "./integrations/links/product-links";
export * from "./integrations/links/variant-links";

// Taxonomy schemas
export * from "./taxonomy/taxonomy-categories";
export * from "./taxonomy/taxonomy-attributes";
export * from "./taxonomy/taxonomy-values";
export * from "./taxonomy/taxonomy-external-mappings";