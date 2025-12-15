/**
 * UI Constants
 *
 * Labels, categories, and other constants for UI components.
 */

import type { FieldCategory } from "../registry/types";

/**
 * Category labels for UI display.
 */
export const FIELD_CATEGORY_LABELS: Record<FieldCategory | string, string> = {
  identifiers: "Identifiers",
  basic: "Basic Info",
  commercial: "Commercial",
  organization: "Organization",
  physical: "Physical",
  environment: "Environment",
  materials: "Materials",
  "supply-chain": "Supply Chain",
  certifications: "Certifications",
  media: "Media",
  variants: "Variants",
};

/**
 * Entity labels for UI display.
 */
export const ENTITY_LABELS: Record<string, string> = {
  product: "Product",
  variant: "Variant",
  environment: "Environmental Data",
  material: "Material",
  productMaterial: "Product Material",
  facility: "Facility",
  journeyStep: "Journey Step",
  manufacturer: "Manufacturer",
  season: "Season",
  category: "Category",
  color: "Color",
  size: "Size",
  tag: "Tag",
  ecoClaim: "Eco Claim",
  certification: "Certification",
};

/**
 * Integration status labels.
 */
export const INTEGRATION_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  error: "Error",
  pending: "Pending Setup",
};

/**
 * Integration status colors for UI.
 */
export const INTEGRATION_STATUS_COLORS: Record<string, string> = {
  active: "green",
  inactive: "gray",
  error: "red",
  pending: "yellow",
};

/**
 * Sync job status labels.
 */
export const SYNC_JOB_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

