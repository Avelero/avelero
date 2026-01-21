/**
 * Promotion Types
 *
 * Type definitions for primary integration promotion operations.
 * Used when promoting a secondary integration to primary, which triggers
 * a complete re-grouping of products based on the new primary's structure.
 *
 * @see integration-refactor-plan.md Section 2.5 for algorithm details
 */

// =============================================================================
// CONFIG & PROGRESS
// =============================================================================

/**
 * Configuration for a promotion operation.
 */
export interface PromotionConfig {
  /** Brand ID */
  brandId: string;
  /** Integration ID being promoted to primary */
  newPrimaryIntegrationId: string;
  /** Previous primary integration ID (null if none) */
  oldPrimaryIntegrationId: string | null;
}

/**
 * Phases of the promotion algorithm.
 * Matches the phases defined in integration-refactor-plan.md
 */
export type PromotionPhase =
  | "preparing" // Phase 0: Create temp tables, mark operation in progress
  | "fetching" // Phase 1: Fetch external structure from new primary
  | "computing" // Phase 2-3: Compute variant assignments and main products
  | "creating_products" // Phase 4: Create missing products
  | "re_parenting" // Phase 5: Re-parent variants to new products
  | "handling_orphans" // Phase 6: Handle orphaned variants
  | "archiving" // Phase 7: Archive empty products
  | "updating_attributes" // Phase 8: Handle attributes
  | "updating_links" // Phase 9-10: Update product data and integration links
  | "cleanup" // Phase 11: Cleanup temp tables, finalize
  | "completed" // Operation finished successfully
  | "failed"; // Operation failed

/**
 * Progress tracking for a promotion operation.
 */
export interface PromotionProgress {
  /** Unique operation ID */
  operationId: string;
  /** Current phase */
  phase: PromotionPhase;
  /** Numeric phase (0-11) */
  phaseNumber: number;
  /** Number of variants processed so far */
  variantsProcessed: number;
  /** Total number of variants to process */
  totalVariants: number;
  /** Number of products created */
  productsCreated: number;
  /** Number of products archived (empty after re-grouping) */
  productsArchived: number;
  /** Number of variants moved between products */
  variantsMoved: number;
  /** Number of orphaned variants (not in new primary) */
  variantsOrphaned: number;
  /** Number of attributes created */
  attributesCreated: number;
}

/**
 * Result of a promotion operation.
 */
export interface PromotionResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Operation ID for tracking */
  operationId: string;
  /** Final statistics */
  stats: PromotionProgress;
  /** Error message if failed */
  error?: string;
}

// =============================================================================
// INTERNAL TYPES (used during promotion processing)
// =============================================================================

/**
 * External product grouping data (from temp table).
 * Represents how the new primary groups variants.
 */
export interface ExternalGrouping {
  /** Variant barcode */
  barcode: string;
  /** External product ID */
  externalProductId: string;
  /** External variant ID */
  externalVariantId: string;
  /** Product-level data as JSON */
  externalProductData: ExternalProductData;
  /** Variant-level data as JSON */
  externalVariantData: ExternalVariantData;
}

/**
 * Product data from external system.
 */
export interface ExternalProductData {
  name?: string;
  description?: string;
  imagePath?: string;
  [key: string]: unknown;
}

/**
 * Variant data from external system.
 */
export interface ExternalVariantData {
  sku?: string;
  barcode?: string;
  selectedOptions?: Array<{ name: string; value: string }>;
  [key: string]: unknown;
}

/**
 * Variant assignment computed during promotion.
 */
interface VariantAssignment {
  /** Avelero variant ID */
  aveleroVariantId: string;
  /** Current parent product ID */
  currentProductId: string;
  /** Target external product ID (null = orphaned) */
  targetExternalProductId: string | null;
}

/**
 * Main product mapping (which Avelero product represents each external product).
 */
interface MainProductMapping {
  /** External product ID from new primary */
  targetExternalProductId: string;
  /** Avelero product that will be the "main" one (null = needs creation) */
  mainAveleroProductId: string | null;
  /** Number of variants currently in this product */
  variantCount: number;
}

/**
 * A variant that needs to be moved to a different parent product.
 */
export interface VariantMove {
  /** Variant ID */
  variantId: string;
  /** Current parent product ID */
  currentProductId: string;
  /** New parent product ID */
  newProductId: string;
}

/**
 * An orphaned variant (barcode not found in new primary).
 */
interface OrphanedVariant {
  /** Variant ID */
  variantId: string;
  /** Product ID the variant belongs to */
  productId: string;
  /** Variant barcode */
  barcode: string | null;
}

// =============================================================================
// CONTEXT TYPES
// =============================================================================

/**
 * Context passed to promotion phase handlers.
 */
export interface PromotionContext {
  /** Database instance */
  db: unknown;
  /** Promotion configuration */
  config: PromotionConfig;
  /** Operation ID */
  operationId: string;
  /** Progress tracking (mutable, updated during phases) */
  progress: PromotionProgress;
  /** Decrypted credentials for fetching from external system */
  credentials: Record<string, unknown>;
  /** Integration slug (e.g., 'shopify', 'its-perfect') */
  integrationSlug: string;
  /** Callback to update progress in database */
  onProgress?: (progress: PromotionProgress) => Promise<void>;
}

/**
 * Batch processing configuration.
 */
const PROMOTION_CONFIG = {
  /** Number of products to fetch per API request */
  FETCH_BATCH_SIZE: 250,
  /** Number of products to process per database transaction */
  TRANSACTION_BATCH_SIZE: 1000,
  /** Number of variants to re-parent per transaction */
  REPARENT_BATCH_SIZE: 1000,
} as const;
