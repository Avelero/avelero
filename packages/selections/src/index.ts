/*
  @v1/selections
  Predefined selection options for the apparel industry.
  Single source of truth for categories, colors, certifications, and more.
*/

// Re-export everything for convenience
// Note: fonts are NOT re-exported here to avoid eagerly loading the 13k-line dataset
// Import fonts explicitly from '@v1/selections/fonts' when needed
export * from "./certifications";
export * from "./colors";
export * from "./countries";
export * from "./production-steps";
export * from "./sizes";
