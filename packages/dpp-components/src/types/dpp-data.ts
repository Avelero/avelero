/**
 * DPP Data Types - EU Digital Product Passport Compliance Data
 *
 * These types represent the core compliance data structure for Digital Product Passports
 * as defined by the EU ESPR (Ecodesign for Sustainable Products Regulation).
 *
 * This file contains ONLY compliance-related data that will be:
 * - Submitted to the EU public registry when mandated
 * - Used for regulatory compliance validation
 * - Part of the official DPP JSON-LD schema
 *
 * Non-compliance data (similar products, marketing content) should be in dpp-content.ts
 */

// =============================================================================
// SHARED / REUSABLE TYPES
// =============================================================================

/**
 * Represents a value with its unit of measurement
 */
export interface MeasuredValue {
  value: number;
  unit: string;
}

/**
 * Testing institute details for material certifications
 */
export interface TestingInstitute {
  legalName: string;
  email?: string;
  phone?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  country?: string;
  state?: string;
  city?: string;
  postalCode?: string;
}

// =============================================================================
// PRODUCT IDENTIFIERS
// =============================================================================

/**
 * Core product identification data
 *
 * Article number is derived from variant identifiers using precedence:
 * barcode > GTIN > EAN > SKU
 *
 * At product-level DPP (no variant), articleNumber will be empty since
 * identifiers are tracked at the variant level.
 */
export interface ProductIdentifiers {
  productId: number;
  productName: string;
  productImage: string;
  /**
   * Article number displayed on DPP.
   * Derived from variant: barcode > GTIN > EAN > SKU precedence.
   * Empty string at product-level (no variant selected).
   */
  articleNumber: string;
  /** European Article Number (barcode) - variant-level */
  ean?: string;
  /** Global Trade Item Number - variant-level */
  gtin?: string;
}

// =============================================================================
// PRODUCT DETAILS
// =============================================================================

/**
 * Category reference with ID
 */
export interface CategoryReference {
  categoryId: number;
  category: string;
}

/**
 * Generic variant attribute (name/value pair)
 * Used for displaying variant-specific attributes like Color, Size, etc.
 */
export interface VariantAttribute {
  name: string;
  value: string;
}

/**
 * Product attribute details
 */
export interface ProductAttributes {
  description?: string;
  brand: string;
  category?: CategoryReference;
  /** Variant attributes (0-3) - generic name/value pairs */
  attributes?: VariantAttribute[];
  /** Product weight (stored in products.weight and products.weight_unit) */
  weight?: MeasuredValue;
}

// =============================================================================
// ENVIRONMENTAL DATA
// =============================================================================

/**
 * Environmental claim reference
 */
export interface EcoClaim {
  ecoClaimId: number;
  ecoClaim: string;
}

/**
 * Environmental impact data
 */
export interface Environmental {
  waterUsage?: MeasuredValue;
  carbonEmissions?: MeasuredValue;
  ecoClaims?: EcoClaim[];
}

// =============================================================================
// MATERIALS DATA
// =============================================================================

/**
 * Material certification details
 */
export interface MaterialCertification {
  type: string;
  code: string;
  testingInstitute?: TestingInstitute;
}

/**
 * Individual material composition entry
 */
export interface MaterialComposition {
  materialId: number;
  material: string;
  percentage: number;
  recyclable?: boolean;
  countryOfOrigin?: string;
  certification?: MaterialCertification;
}

/**
 * Materials section with composition breakdown
 */
export interface Materials {
  composition: MaterialComposition[];
}

// =============================================================================
// MANUFACTURING & SUPPLY CHAIN
// =============================================================================

/**
 * Manufacturer details
 * Aligns with brand_manufacturers table
 */
export interface Manufacturer {
  manufacturerId: number;
  name: string;
  legalName?: string;
  email?: string;
  phone?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  countryCode?: string;
}

/**
 * Supply chain operator/facility details
 * Aligns with brand_facilities table
 */
export interface Operator {
  operatorId: number;
  name?: string;
  legalName: string;
  email?: string;
  phone?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  countryCode?: string;
}

/**
 * Individual supply chain step
 */
export interface SupplyChainStep {
  processStep?: string;
  operator: Operator;
}

/**
 * Manufacturing and supply chain information
 */
export interface Manufacturing {
  /** Product manufacturer (from brand_manufacturers) */
  manufacturer?: Manufacturer;
  /** Supply chain traceability */
  supplyChain?: SupplyChainStep[];
}

// =============================================================================
// MAIN DPP DATA TYPE
// =============================================================================

/**
 * Complete Digital Product Passport Data
 *
 * Represents all compliance-related data for a product's digital passport.
 * Aligns with the EU ESPR requirements and JSON-LD schema structure.
 */
export interface DppData {
  // JSON-LD context (optional, for serialization)
  "@context"?: {
    "@vocab"?: string;
    dpp?: string;
    espr?: string;
  };
  "@type"?: string;
  "@id"?: string;

  // Core product data
  productIdentifiers: ProductIdentifiers;
  productAttributes: ProductAttributes;

  // Environmental compliance
  environmental?: Environmental;

  // Material composition
  materials?: Materials;

  // Manufacturing & supply chain traceability
  manufacturing?: Manufacturing;
}
