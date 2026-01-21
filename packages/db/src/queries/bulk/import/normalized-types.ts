/**
 * Normalized row data types for bulk import.
 *
 * This JSONB structure stores all validated/transformed data in import_rows.normalized,
 * replacing the need for separate staging tables. The commit-to-production job reads
 * directly from this structure.
 *
 * Benefits:
 * - Single source of truth (import_rows table only)
 * - ~60% code reduction (eliminates 15 staging tables and their queries)
 * - Simpler mental model
 * - Fewer database round-trips
 */

/**
 * Row-level error information
 */
export interface RowError {
  field: string;
  message: string;
}

/**
 * Row status for import processing
 * - PENDING: No errors, ready for commit
 * - PENDING_WITH_WARNINGS: Has non-blocking field errors, will still be committed
 * - BLOCKED: Has blocking errors (missing required fields), cannot commit
 * - COMMITTED: Successfully written to production
 * - FAILED: Commit failed (database error, etc.)
 */
export type RowStatus =
  | "PENDING"
  | "PENDING_WITH_WARNINGS"
  | "BLOCKED"
  | "COMMITTED"
  | "FAILED";

/**
 * Product action type
 */
export type ProductAction = "CREATE" | "UPDATE" | "SKIP";

/**
 * Variant action type
 */
export type VariantAction = "CREATE" | "UPDATE";

/**
 * Normalized material data
 */
export interface NormalizedMaterial {
  brandMaterialId: string;
  percentage: string | null;
}

/**
 * Normalized environment data
 */
export interface NormalizedEnvironment {
  carbonKgCo2e: string | null;
  waterLiters: string | null;
}

/**
 * Normalized journey step data.
 * Each step can have multiple operators.
 */
export interface NormalizedJourneyStep {
  sortIndex: number;
  stepType: string;
  operatorIds: string[];
}

/**
 * Normalized weight data
 */
export interface NormalizedWeight {
  weight: string;
  weightUnit: string;
}

/**
 * Normalized variant attribute
 */
export interface NormalizedVariantAttribute {
  attributeId: string;
  attributeValueId: string;
  sortOrder: number;
}

/**
 * Normalized variant data
 */
export interface NormalizedVariant {
  /** Staging variant ID (used for tracking) */
  stagingId: string;
  /** Row number in the Excel file */
  rowNumber: number;
  /** Action to take: CREATE or UPDATE */
  action: VariantAction;
  /** Existing variant ID if updating */
  existingVariantId: string | null;
  /** New variant ID (for CREATE) or existing (for UPDATE) */
  id: string;
  /** Parent product ID */
  productId: string;
  /** Unique Product Identifier (legacy, optional) */
  upid: string | null;
  /** Product barcode (EAN/UPC) */
  barcode: string | null;
  /** Stock Keeping Unit */
  sku: string | null;
  /** Variant-level name override */
  nameOverride: string | null;
  /** Variant-level description override */
  descriptionOverride: string | null;
  /** Variant-level image path override */
  imagePathOverride: string | null;
  /** Row processing status */
  rowStatus: RowStatus;
  /** Validation errors for this variant */
  errors: RowError[];
  /** Variant attributes (color, size, etc.) */
  attributes: NormalizedVariantAttribute[];
  /** Variant-level material overrides */
  materials: NormalizedMaterial[];
  /** Variant-level environment overrides */
  environment: NormalizedEnvironment | null;
  /** Variant-level journey step overrides */
  journeySteps: NormalizedJourneyStep[];
  /** Variant-level weight override */
  weight: NormalizedWeight | null;
  /** Original Excel row data for error reporting */
  rawData: Record<string, string>;
}

/**
 * Normalized product data stored in import_rows.normalized
 *
 * This structure contains all the validated and transformed data needed
 * to commit a product and its variants to production.
 */
export interface NormalizedRowData {
  /** Staging product ID (used for tracking) */
  stagingId: string;
  /** Row number in the Excel file */
  rowNumber: number;
  /** Action to take: CREATE, UPDATE, or SKIP */
  action: ProductAction;
  /** Existing product ID if updating */
  existingProductId: string | null;
  /** New product ID (for CREATE) or existing (for UPDATE) */
  id: string;
  /** Brand ID */
  brandId: string;
  /** URL-friendly product handle */
  productHandle: string;
  /** Product name/title */
  name: string;
  /** Product description */
  description: string | null;
  /** Image path (URL or storage path) */
  imagePath: string | null;
  /** Category ID (resolved from catalog) */
  categoryId: string | null;
  /** Season ID (resolved from catalog) */
  seasonId: string | null;
  /** Manufacturer ID (resolved from catalog) */
  manufacturerId: string | null;
  /** Publication status */
  status: string;
  /** Row processing status */
  rowStatus: RowStatus;
  /** Validation errors for this product */
  errors: RowError[];
  /** Product variants */
  variants: NormalizedVariant[];
  /** Product tags (IDs) */
  tags: string[];
  /** Product-level materials */
  materials: NormalizedMaterial[];
  /** Product-level environment data */
  environment: NormalizedEnvironment | null;
  /** Product-level journey steps */
  journeySteps: NormalizedJourneyStep[];
  /** Product-level weight */
  weight: NormalizedWeight | null;
}

/**
 * Type guard to check if data is a valid NormalizedRowData
 */
export function isNormalizedRowData(data: unknown): data is NormalizedRowData {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.stagingId === "string" &&
    typeof d.rowNumber === "number" &&
    typeof d.action === "string" &&
    typeof d.id === "string" &&
    typeof d.brandId === "string" &&
    typeof d.name === "string" &&
    Array.isArray(d.variants)
  );
}
