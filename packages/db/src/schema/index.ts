// Core schemas
export * from "./core/users";
export * from "./core/brands";
export * from "./core/brand-members";
export * from "./core/brand-invites";

// Brand schemas
export * from "./brands/categories";
export * from "./brands/brand-certifications";
export * from "./brands/brand-collections";
export * from "./brands/brand-colors";
export * from "./brands/brand-eco-claims";
export * from "./brands/brand-facilities";
export * from "./brands/brand-materials";
export * from "./brands/brand-services";
export * from "./brands/brand-sizes";
export * from "./brands/care-codes";
export * from "./brands/showcase-brands";

// Product schemas
export * from "./products/products";
export * from "./products/product-variants";
export * from "./products/passports";
export * from "./products/passport-templates";
export * from "./products/templates";
export * from "./products/modules";
export * from "./products/product-materials";
export * from "./products/product-journey-steps";
export * from "./products/product-environment";
export * from "./products/product-identifiers";
export * from "./products/product-variant-identifiers";
export * from "./products/product-eco-claims";
export * from "./products/product-care-codes";

// Data schemas
export * from "./data/file-assets";
export * from "./data/import-jobs";
export * from "./data/import-rows";
export * from "./data/value-mappings";

// Shared schemas
export * from "../extensions/shared";
// export * from "../extensions/enums"; // Commented out to avoid userRoleEnum conflict
export * from "../extensions/validation-utils";

// Module schema extensions (NEW: Task 1.3)
export * from "../extensions/modules";

// Templates and Modules module schemas (NEW: Task 5.1)
export * from "../extensions/modules/templates";
export * from "../extensions/modules/modules";

// Cross-module relationship system (NEW: Task 7.1)
export * from "../extensions/cross-module-includes";
export * from "../extensions/cross-module-relationships";
