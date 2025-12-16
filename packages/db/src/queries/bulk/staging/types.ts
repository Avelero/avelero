/**
 * Shared types for staging operations.
 */

/**
 * Staging product insertion parameters
 */
export interface InsertStagingProductParams {
  jobId: string;
  rowNumber: number;
  action: "CREATE" | "UPDATE" | "SKIP";
  existingProductId?: string | null;
  id: string;
  brandId: string;
  /** URL-friendly product handle for DPP URLs */
  productHandle: string;
  /** Internal 16-character UPID (legacy, still stored in products table) */
  productUpid?: string | null;
  name: string;
  description?: string | null;
  manufacturerId?: string | null;
  primaryImagePath?: string | null;
  categoryId?: string | null;
  seasonId?: string | null; // FK to brand_seasons.id
  status?: string | null; // Product publication status
}

/**
 * Staging product variant insertion parameters
 */
export interface InsertStagingVariantParams {
  stagingProductId: string;
  jobId: string;
  rowNumber: number;
  action: "CREATE" | "UPDATE" | "SKIP";
  existingVariantId?: string | null;
  id: string;
  productId: string;
  colorId?: string | null;
  sizeId?: string | null;
  upid: string;
}

/**
 * Staging product material insertion parameters
 */
export interface InsertStagingMaterialParams {
  stagingProductId: string;
  jobId: string;
  brandMaterialId: string;
  percentage?: string | null;
}

/**
 * Staging product eco claim insertion parameters
 */
export interface InsertStagingEcoClaimParams {
  stagingProductId: string;
  jobId: string;
  ecoClaimId: string;
}

/**
 * Staging product journey step insertion parameters
 */
export interface InsertStagingJourneyStepParams {
  stagingProductId: string;
  jobId: string;
  sortIndex: number;
  stepType: string;
  facilityId: string;
}

/**
 * Staging product environment insertion parameters
 */
export interface InsertStagingEnvironmentParams {
  stagingProductId: string;
  jobId: string;
  carbonKgCo2e?: string | null;
  waterLiters?: string | null;
}

/**
 * Staging product preview data
 */
export interface StagingProductPreview {
  stagingId: string;
  jobId: string;
  rowNumber: number;
  action: string;
  existingProductId: string | null;
  id: string;
  brandId: string;
  /** Product identifier for the product (brand-scoped) */
  productHandle: string;
  /** Product-level UPID for passport URLs */
  productUpid?: string | null;
  name: string;
  description: string | null;
  manufacturerId: string | null;
  primaryImagePath: string | null;
  categoryId: string | null;
  seasonId: string | null; // FK to brand_seasons.id
  status: string | null; // Product publication status
  createdAt: string;
  variant: StagingVariantPreview | null;
  materials: StagingMaterialPreview[];
  ecoClaims: StagingEcoClaimPreview[];
  journeySteps: StagingJourneyStepPreview[];
  environment: StagingEnvironmentPreview | null;
}

/**
 * Staging variant preview data
 */
export interface StagingVariantPreview {
  stagingId: string;
  stagingProductId: string;
  jobId: string;
  rowNumber: number;
  action: string;
  existingVariantId: string | null;
  id: string;
  productId: string;
  colorId: string | null;
  sizeId: string | null;
  upid: string;
  createdAt: string;
}

export interface StagingMaterialPreview {
  stagingId: string;
  stagingProductId: string;
  jobId: string;
  brandMaterialId: string;
  percentage: string | null;
  createdAt: string;
}

export interface StagingEcoClaimPreview {
  stagingId: string;
  stagingProductId: string;
  jobId: string;
  ecoClaimId: string;
  createdAt: string;
}

export interface StagingJourneyStepPreview {
  stagingId: string;
  stagingProductId: string;
  jobId: string;
  sortIndex: number;
  stepType: string;
  facilityId: string;
  createdAt: string;
}

export interface StagingEnvironmentPreview {
  stagingId: string;
  stagingProductId: string;
  jobId: string;
  carbonKgCo2e: string | null;
  waterLiters: string | null;
  createdAt: string;
}

/**
 * Action count summary
 */
export interface ActionCounts {
  create: number;
  update: number;
  total: number;
}

