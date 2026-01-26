/**
 * Product query types and interfaces.
 */

/**
 * Filter options for product list queries
 *
 * Uses FilterState structure (groups with AND/OR logic).
 */
export type ListFilters = {
  search?: string; // Top-level search (separate from FilterState)
  // FilterState structure (groups with AND/OR logic)
  filterState?: {
    groups: Array<{
      id: string;
      conditions: Array<{
        id: string;
        fieldId: string;
        operator: string;
        value: any;
        nestedConditions?: Array<any>;
      }>;
      asGroup?: boolean;
    }>;
  };
};

/**
 * Represents the core product fields exposed by API queries.
 */
export interface ProductRecord {
  id: string;
  name?: string | null;
  description?: string | null;
  category_id?: string | null;
  season_id?: string | null;
  manufacturer_id?: string | null;
  image_path?: string | null;
  product_handle?: string | null;
  upid?: string | null;
  status?: string | null;
  created_at?: string;
  updated_at?: string;
  // Enriched fields from joins
  category_name?: string | null;
  category_path?: string[] | null;
  season_name?: string | null;
}

/**
 * Variant summary returned alongside products.
 */
export interface ProductVariantSummary {
  id: string;
  product_id: string;
  sku: string | null;
  barcode: string | null;
  upid: string | null;
  created_at: string;
  updated_at: string;
  /** Whether this is a ghost variant (system-created, invisible to users) */
  isGhost: boolean;
}

/**
 * Attribute summary for variant read operations.
 * Simpler version of VariantAttributeAssignment for API responses.
 */
export interface VariantAttributeSummary {
  attribute_id: string;
  attribute_name: string;
  /**
   * Present when the brand attribute is linked to a taxonomy attribute.
   * Needed by clients to rehydrate taxonomy-linked dimensions and access
   * taxonomy metadata (e.g. color swatches).
   */
  taxonomy_attribute_id: string | null;
  value_id: string;
  value_name: string;
  /**
   * Present when the brand attribute value is linked to a taxonomy value.
   * Needed by clients to rehydrate taxonomy-linked dimensions and access
   * taxonomy metadata (e.g. color swatches).
   */
  taxonomy_value_id: string | null;
}

/**
 * Variant with attributes for read operations.
 * Extends ProductVariantSummary with attribute data.
 */
export interface ProductVariantWithAttributes extends ProductVariantSummary {
  attributes: VariantAttributeSummary[];
  /** Whether this variant has override data (differs from product level) */
  hasOverrides?: boolean;
}

/**
 * Material composition entry for a product.
 */
export interface ProductMaterialSummary {
  id: string;
  brand_material_id: string;
  material_name: string | null;
  percentage: string | null;
}

/**
 * Journey step entry for a product passport.
 */
export interface ProductJourneyStepSummary {
  id: string;
  sort_index: number;
  step_type: string;
  operator_id: string;
  operator_name: string | null;
}

/**
 * Environmental impact metrics for a product when available.
 */
export interface ProductEnvironmentSummary {
  product_id: string;
  carbon_kg_co2e: string | null;
  water_liters: string | null;
}

/**
 * Weight data for a product.
 */
export interface ProductWeightSummary {
  weight: string | null;
  weight_unit: string | null;
}

/**
 * Aggregated attributes bundle returned when includeAttributes is enabled.
 */
export interface ProductAttributesBundle {
  materials: ProductMaterialSummary[];
  environment: ProductEnvironmentSummary | null;
  weight: ProductWeightSummary | null;
  journey: ProductJourneyStepSummary[];
  tags: Array<{
    id: string;
    tag_id: string;
    name: string | null;
    hex: string | null;
  }>;
}

/**
 * Product payload enriched with optional relations requested by callers.
 */
export interface ProductWithRelations extends ProductRecord {
  variants?: ProductVariantWithAttributes[];
  attributes?: ProductAttributesBundle;
  /** UPID of the first variant's passport (for viewing the public passport) */
  first_variant_upid?: string | null;
  /** Total number of non-ghost variants for this product */
  variant_count?: number;
  /** Number of non-ghost variants that have a non-empty barcode */
  variants_with_barcode?: number;
}

/**
 * Type-safe product field names.
 * Re-exported from _shared/fields.ts for convenience.
 */
export type { ProductField } from "./_shared/fields";

/**
 * Product row for carousel selection modal.
 * Contains only the fields needed for display in the selection UI.
 */
export interface CarouselProductRow {
  id: string;
  name: string;
  productHandle: string;
  imagePath: string | null;
  categoryName: string | null;
  seasonName: string | null;
}

/**
 * Identifier for product lookup - accepts either UUID or handle.
 */
export type ProductHandle = { id: string } | { handle: string };

/**
 * Result of a bulk delete operation.
 */
export interface BulkDeleteResult {
  deleted: number;
  imagePaths: string[];
}

/**
 * Result of a bulk update operation.
 */
export interface BulkUpdateResult {
  updated: number;
  /** IDs of products that were updated (for triggering publish on status change) */
  productIds?: string[];
}

/**
 * Fields that can be bulk updated.
 */
export interface BulkUpdateFields {
  status?: string | null;
  categoryId?: string | null;
  seasonId?: string | null;
}

// =============================================================================
// VARIANT ATTRIBUTE TYPES
// =============================================================================

/**
 * Attribute assignment for a variant.
 * Represents a single attribute-value pair assigned to a variant.
 */
export interface VariantAttributeAssignment {
  attributeValueId: string;
  attributeId: string;
  attributeName: string;
  valueName: string;
  sortOrder: number;
}

/**
 * Variant with its attribute assignments.
 */
export interface VariantWithAttributeAssignments {
  id: string;
  productId: string;
  sku: string | null;
  barcode: string | null;
  upid: string | null;
  createdAt: string;
  updatedAt: string;
  attributes: VariantAttributeAssignment[];
}

/**
 * Input for creating a variant with explicit attribute assignments.
 */
export interface ExplicitVariantInput {
  /** Optional SKU for the variant */
  sku?: string;
  /** Optional barcode for the variant */
  barcode?: string;
  /** Optional UPID - will be auto-generated if not provided */
  upid?: string;
  /** Ordered list of attribute value IDs to assign to this variant */
  attributeValueIds?: string[];
}

/**
 * A dimension in a variant matrix.
 * Represents one axis of the cartesian product (e.g., Color with values Red, Blue).
 */
export interface MatrixDimension {
  /** The brand attribute ID for this dimension */
  attributeId: string;
  /** The brand attribute value IDs for this dimension */
  valueIds: string[];
}

/**
 * Result of a replace variants operation.
 */
export interface ReplaceVariantsResult {
  /** Number of variants created */
  created: number;
  /** The created variants with their assignments */
  variants: Array<{
    id: string;
    sku: string | null;
    barcode: string | null;
    upid: string | null;
    attributeValueIds: string[];
  }>;
}
