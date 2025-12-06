/**
 * Public DPP (Digital Product Passport) Query Functions
 *
 * These queries fetch all data needed for public-facing DPP pages.
 * They are designed to be called server-side with serviceDb (bypasses RLS).
 *
 * URL Structure:
 * - Product-level: /:brandSlug/:productUpid
 * - Variant-level: /:brandSlug/:productUpid/:variantUpid
 */

import { and, asc, eq, inArray } from "drizzle-orm";
import { countries, type CountryCode } from "@v1/selections";
import type { ThemeConfig, ThemeStyles } from "@v1/dpp-components";
import type { Database } from "../client";
import {
  products,
  productVariants,
  productMaterials,
  productJourneySteps,
  productJourneyStepFacilities,
  productEnvironment,
  productEcoClaims,
  brands,
  brandTheme,
  brandColors,
  brandSizes,
  brandMaterials,
  brandCertifications,
  brandFacilities,
  brandEcoClaims,
  categories,
  showcaseBrands,
} from "../schema";

// ─────────────────────────────────────────────────────────────────────────────
// Public Interfaces
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Material composition entry for public DPP display
 */
export interface DppMaterial {
  percentage: number;
  materialName: string;
  countryOfOrigin: string | null;
  recyclable: boolean | null;
  certificationTitle: string | null;
  certificationUrl: string | null;
}

/**
 * Facility (operator) information for journey steps
 */
export interface DppFacility {
  displayName: string;
  city: string | null;
  countryCode: string | null;
}

/**
 * Journey step for supply chain visualization
 */
export interface DppJourneyStep {
  sortIndex: number;
  stepType: string;
  facilities: DppFacility[];
}

/**
 * Environmental impact metrics
 */
export interface DppEnvironment {
  carbonKgCo2e: string | null;
  waterLiters: string | null;
}

/**
 * Complete data structure for public DPP rendering.
 * This is the single object returned by the DPP query functions.
 */
export interface DppPublicData {
  // ─────────────────────────────────────────────────────────────
  // Source Identification
  // ─────────────────────────────────────────────────────────────
  sourceType: "product" | "variant";

  // ─────────────────────────────────────────────────────────────
  // Product Core Data (always present)
  // ─────────────────────────────────────────────────────────────
  productId: string;
  productUpid: string;
  productName: string;
  productDescription: string | null;
  productImage: string | null;
  productIdentifier: string;
  productStatus: string;

  // ─────────────────────────────────────────────────────────────
  // Variant Data (null if product-level DPP)
  // ─────────────────────────────────────────────────────────────
  variantId: string | null;
  variantUpid: string | null;
  colorName: string | null;
  sizeName: string | null;

  // ─────────────────────────────────────────────────────────────
  // Brand Data
  // ─────────────────────────────────────────────────────────────
  brandId: string;
  brandName: string;

  // ─────────────────────────────────────────────────────────────
  // Category
  // ─────────────────────────────────────────────────────────────
  categoryId: string | null;
  categoryName: string | null;
  categoryPath: string[] | null;

  // ─────────────────────────────────────────────────────────────
  // Manufacturer (Showcase Brand)
  // ─────────────────────────────────────────────────────────────
  manufacturerName: string | null;
  manufacturerCountryCode: string | null;

  // ─────────────────────────────────────────────────────────────
  // Materials Composition
  // ─────────────────────────────────────────────────────────────
  materials: DppMaterial[];

  // ─────────────────────────────────────────────────────────────
  // Supply Chain Journey
  // ─────────────────────────────────────────────────────────────
  journey: DppJourneyStep[];

  // ─────────────────────────────────────────────────────────────
  // Environmental Impact
  // ─────────────────────────────────────────────────────────────
  environment: DppEnvironment | null;
  ecoClaims: string[];

  // ─────────────────────────────────────────────────────────────
  // Theme Configuration (for rendering)
  // ─────────────────────────────────────────────────────────────
  themeConfig: ThemeConfig | null;
  themeStyles: ThemeStyles | null;
  stylesheetPath: string | null;
  googleFontsUrl: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Types
// ─────────────────────────────────────────────────────────────────────────────

interface CoreDataResult {
  productId: string;
  productUpid: string | null;
  productName: string;
  productDescription: string | null;
  productImage: string | null;
  productIdentifier: string;
  productStatus: string;
  variantId: string | null;
  variantUpid: string | null;
  colorName: string | null;
  sizeName: string | null;
  brandId: string;
  brandName: string;
  brandSlug: string | null;
  categoryId: string | null;
  categoryName: string | null;
  manufacturerName: string | null;
  manufacturerCountryCode: string | null;
  themeConfig: unknown | null;
  themeStyles: unknown | null;
  stylesheetPath: string | null;
  googleFontsUrl: string | null;
}

interface ProductAttributes {
  materials: DppMaterial[];
  journey: DppJourneyStep[];
  environment: DppEnvironment | null;
  ecoClaims: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stage 1: Fetch core product/variant data with essential JOINs.
 * Includes published status check.
 * Looks up brand by slug instead of UUID.
 */
async function fetchCoreData(
  db: Database,
  brandSlug: string,
  productUpid: string,
  variantUpid?: string,
): Promise<CoreDataResult | null> {
  if (variantUpid) {
    // Variant-level query
    const rows = await db
      .select({
        // Product
        productId: products.id,
        productUpid: products.upid,
        productName: products.name,
        productDescription: products.description,
        productImage: products.primaryImagePath,
        productIdentifier: products.productIdentifier,
        productStatus: products.status,
        // Variant
        variantId: productVariants.id,
        variantUpid: productVariants.upid,
        colorName: brandColors.name,
        sizeName: brandSizes.name,
        // Brand
        brandId: brands.id,
        brandName: brands.name,
        brandSlug: brands.slug,
        // Category
        categoryId: products.categoryId,
        categoryName: categories.name,
        // Manufacturer (Showcase Brand)
        manufacturerName: showcaseBrands.name,
        manufacturerCountryCode: showcaseBrands.countryCode,
        // Theme
        themeConfig: brandTheme.themeConfig,
        themeStyles: brandTheme.themeStyles,
        stylesheetPath: brandTheme.stylesheetPath,
        googleFontsUrl: brandTheme.googleFontsUrl,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .innerJoin(brands, eq(brands.id, products.brandId))
      .leftJoin(brandTheme, eq(brandTheme.brandId, products.brandId))
      .leftJoin(brandColors, eq(brandColors.id, productVariants.colorId))
      .leftJoin(brandSizes, eq(brandSizes.id, productVariants.sizeId))
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(showcaseBrands, eq(showcaseBrands.id, products.showcaseBrandId))
      .where(
        and(
          eq(brands.slug, brandSlug),
          eq(products.upid, productUpid),
          eq(productVariants.upid, variantUpid),
          eq(products.status, "published"),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  // Product-level query
  const rows = await db
    .select({
      productId: products.id,
      productUpid: products.upid,
      productName: products.name,
      productDescription: products.description,
      productImage: products.primaryImagePath,
      productIdentifier: products.productIdentifier,
      productStatus: products.status,
      brandId: brands.id,
      brandName: brands.name,
      brandSlug: brands.slug,
      categoryId: products.categoryId,
      categoryName: categories.name,
      manufacturerName: showcaseBrands.name,
      manufacturerCountryCode: showcaseBrands.countryCode,
      themeConfig: brandTheme.themeConfig,
      themeStyles: brandTheme.themeStyles,
      stylesheetPath: brandTheme.stylesheetPath,
      googleFontsUrl: brandTheme.googleFontsUrl,
    })
    .from(products)
    .innerJoin(brands, eq(brands.id, products.brandId))
    .leftJoin(brandTheme, eq(brandTheme.brandId, products.brandId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(showcaseBrands, eq(showcaseBrands.id, products.showcaseBrandId))
    .where(
      and(
        eq(brands.slug, brandSlug),
        eq(products.upid, productUpid),
        eq(products.status, "published"),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    ...row,
    variantId: null,
    variantUpid: null,
    colorName: null,
    sizeName: null,
  };
}

/**
 * Helper: Fetch journey steps with their associated facilities.
 * Uses batch loading to avoid N+1 queries.
 */
async function fetchJourneyWithFacilities(
  db: Database,
  productId: string,
): Promise<DppJourneyStep[]> {
  // Get journey steps
  const steps = await db
    .select({
      id: productJourneySteps.id,
      sortIndex: productJourneySteps.sortIndex,
      stepType: productJourneySteps.stepType,
    })
    .from(productJourneySteps)
    .where(eq(productJourneySteps.productId, productId))
    .orderBy(asc(productJourneySteps.sortIndex));

  if (steps.length === 0) return [];

  // Get all facilities for these steps in one query
  const stepIds = steps.map((s) => s.id);
  const facilityRows = await db
    .select({
      journeyStepId: productJourneyStepFacilities.journeyStepId,
      displayName: brandFacilities.displayName,
      city: brandFacilities.city,
      countryCode: brandFacilities.countryCode,
    })
    .from(productJourneyStepFacilities)
    .innerJoin(
      brandFacilities,
      eq(brandFacilities.id, productJourneyStepFacilities.facilityId),
    )
    .where(inArray(productJourneyStepFacilities.journeyStepId, stepIds));

  // Group facilities by step
  const facilitiesByStep = new Map<string, DppFacility[]>();
  for (const row of facilityRows) {
    const existing = facilitiesByStep.get(row.journeyStepId) ?? [];
    existing.push({
      displayName: row.displayName,
      city: row.city,
      countryCode: row.countryCode,
    });
    facilitiesByStep.set(row.journeyStepId, existing);
  }

  return steps.map((step) => ({
    sortIndex: step.sortIndex,
    stepType: step.stepType,
    facilities: facilitiesByStep.get(step.id) ?? [],
  }));
}

/**
 * Stage 2: Fetch product attributes (materials, journey, environment, eco claims).
 * Runs queries in parallel for better performance.
 */
async function fetchProductAttributes(
  db: Database,
  productId: string,
): Promise<ProductAttributes> {
  const [materials, journey, environmentRows, ecoClaimRows] = await Promise.all(
    [
      // Materials with certification info
      db
        .select({
          percentage: productMaterials.percentage,
          materialName: brandMaterials.name,
          countryOfOrigin: brandMaterials.countryOfOrigin,
          recyclable: brandMaterials.recyclable,
          certificationTitle: brandCertifications.title,
          certificationUrl: brandCertifications.externalUrl,
        })
        .from(productMaterials)
        .innerJoin(
          brandMaterials,
          eq(brandMaterials.id, productMaterials.brandMaterialId),
        )
        .leftJoin(
          brandCertifications,
          eq(brandCertifications.id, brandMaterials.certificationId),
        )
        .where(eq(productMaterials.productId, productId))
        .orderBy(asc(productMaterials.createdAt)),

      // Journey steps with facilities
      fetchJourneyWithFacilities(db, productId),

      // Environment metrics
      db
        .select({
          carbonKgCo2e: productEnvironment.carbonKgCo2e,
          waterLiters: productEnvironment.waterLiters,
        })
        .from(productEnvironment)
        .where(eq(productEnvironment.productId, productId))
        .limit(1),

      // Eco claims
      db
        .select({
          claim: brandEcoClaims.claim,
        })
        .from(productEcoClaims)
        .innerJoin(
          brandEcoClaims,
          eq(brandEcoClaims.id, productEcoClaims.ecoClaimId),
        )
        .where(eq(productEcoClaims.productId, productId)),
    ],
  );

  return {
    materials: materials.map((m) => ({
      percentage: m.percentage ? Number(m.percentage) : 0,
      materialName: m.materialName,
      countryOfOrigin: m.countryOfOrigin,
      recyclable: m.recyclable,
      certificationTitle: m.certificationTitle,
      certificationUrl: m.certificationUrl,
    })),
    journey,
    environment: environmentRows[0]
      ? {
          carbonKgCo2e: environmentRows[0].carbonKgCo2e
            ? String(environmentRows[0].carbonKgCo2e)
            : null,
          waterLiters: environmentRows[0].waterLiters
            ? String(environmentRows[0].waterLiters)
            : null,
        }
      : null,
    ecoClaims: ecoClaimRows.map((c) => c.claim),
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// Public Query Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch complete DPP data for a product-level passport.
 *
 * @param db - Database instance (use serviceDb for bypassing RLS)
 * @param brandSlug - Brand slug (URL-friendly identifier)
 * @param productUpid - Product UPID (16-char alphanumeric)
 * @returns DppPublicData or null if not found/not published
 */
export async function getDppByProductUpid(
  db: Database,
  brandSlug: string,
  productUpid: string,
): Promise<DppPublicData | null> {
  // Stage 1: Core data
  const core = await fetchCoreData(db, brandSlug, productUpid);
  if (!core) return null;

  // Stage 2: Attributes
  const attributes = await fetchProductAttributes(db, core.productId);

  return {
    sourceType: "product",
    productId: core.productId,
    productUpid: core.productUpid!,
    productName: core.productName,
    productDescription: core.productDescription,
    productImage: core.productImage,
    productIdentifier: core.productIdentifier,
    productStatus: core.productStatus,
    variantId: null,
    variantUpid: null,
    colorName: null,
    sizeName: null,
    brandId: core.brandId,
    brandName: core.brandName,
    categoryId: core.categoryId,
    categoryName: core.categoryName,
    categoryPath: null, // Deprecated - use categoryName directly
    manufacturerName: core.manufacturerName,
    manufacturerCountryCode: core.manufacturerCountryCode,
    materials: attributes.materials,
    journey: attributes.journey,
    environment: attributes.environment,
    ecoClaims: attributes.ecoClaims,
    themeConfig: (core.themeConfig as ThemeConfig | null) ?? null,
    themeStyles: (core.themeStyles as ThemeStyles | null) ?? null,
    stylesheetPath: core.stylesheetPath,
    googleFontsUrl: core.googleFontsUrl,
  };
}

/**
 * Fetch complete DPP data for a variant-level passport.
 *
 * @param db - Database instance (use serviceDb for bypassing RLS)
 * @param brandSlug - Brand slug (URL-friendly identifier)
 * @param productUpid - Product UPID (16-char alphanumeric)
 * @param variantUpid - Variant UPID (16-char alphanumeric)
 * @returns DppPublicData or null if not found/not published
 */
export async function getDppByVariantUpid(
  db: Database,
  brandSlug: string,
  productUpid: string,
  variantUpid: string,
): Promise<DppPublicData | null> {
  // Stage 1: Core data (includes variant info)
  const core = await fetchCoreData(db, brandSlug, productUpid, variantUpid);
  if (!core) return null;

  // Stage 2: Attributes (same as product-level)
  const attributes = await fetchProductAttributes(db, core.productId);

  return {
    sourceType: "variant",
    productId: core.productId,
    productUpid: core.productUpid!,
    productName: core.productName,
    productDescription: core.productDescription,
    productImage: core.productImage,
    productIdentifier: core.productIdentifier,
    productStatus: core.productStatus,
    variantId: core.variantId,
    variantUpid: core.variantUpid,
    colorName: core.colorName,
    sizeName: core.sizeName,
    brandId: core.brandId,
    brandName: core.brandName,
    categoryId: core.categoryId,
    categoryName: core.categoryName,
    categoryPath: null, // Deprecated - use categoryName directly
    manufacturerName: core.manufacturerName,
    manufacturerCountryCode: core.manufacturerCountryCode,
    materials: attributes.materials,
    journey: attributes.journey,
    environment: attributes.environment,
    ecoClaims: attributes.ecoClaims,
    themeConfig: (core.themeConfig as ThemeConfig | null) ?? null,
    themeStyles: (core.themeStyles as ThemeStyles | null) ?? null,
    stylesheetPath: core.stylesheetPath,
    googleFontsUrl: core.googleFontsUrl,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Transform Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a country code to its full name.
 * Returns the code if no match is found.
 */
function getCountryName(code: string | null): string {
  if (!code) return "";
  const upperCode = code.toUpperCase() as CountryCode;
  return countries[upperCode]?.name ?? code;
}

/**
 * Format a numeric string by removing trailing zeros.
 * Example: "88.4500" → "88.45", "100.0000" → "100"
 */
function formatNumber(value: string): string {
  const num = Number.parseFloat(value);
  if (Number.isNaN(num)) return value;
  // Use toLocaleString for nice formatting, or just remove trailing zeros
  return num.toString();
}

/**
 * Impact metric for DppData format
 */
interface ImpactMetric {
  type: string;
  value: string;
  unit: string;
  icon: "leaf" | "drop" | "recycle" | "factory";
}

/**
 * Journey stage for DppData format
 */
interface JourneyStage {
  name: string;
  companies: Array<{
    name: string;
    location: string;
  }>;
}

/**
 * Material for DppData format
 */
interface MaterialDisplay {
  percentage: number;
  type: string;
  origin: string;
  certification?: string;
  certificationUrl?: string;
}

/**
 * DppData interface (matches @v1/dpp-components)
 */
export interface DppData {
  title: string;
  brandName: string;
  productImage: string;
  description: string;
  size: string;
  color: string;
  category: string;
  articleNumber: string;
  manufacturer: string;
  countryOfOrigin: string;
  materials: MaterialDisplay[];
  journey: JourneyStage[];
  impactMetrics: ImpactMetric[];
  impactClaims: string[];
  similarProducts: Array<{
    image: string;
    name: string;
    price: number;
    currency?: string;
    url?: string;
  }>;
}

/**
 * Format step type from snake_case to Title Case.
 * Example: "raw_material" → "Raw Material"
 */
function formatStepType(stepType: string): string {
  return stepType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Build impact metrics array from environment data.
 */
function buildImpactMetrics(env: DppEnvironment | null): ImpactMetric[] {
  const metrics: ImpactMetric[] = [];

  if (env?.carbonKgCo2e) {
    metrics.push({
      type: "Carbon Footprint",
      value: formatNumber(env.carbonKgCo2e),
      unit: "kg CO₂e",
      icon: "leaf", // Use leaf for carbon/environmental metrics
    });
  }

  if (env?.waterLiters) {
    metrics.push({
      type: "Water Usage",
      value: formatNumber(env.waterLiters),
      unit: "liters",
      icon: "drop",
    });
  }

  return metrics;
}

/**
 * Transform DppPublicData (database format) to DppData (component format).
 *
 * Use this function to convert the query result to the format expected
 * by @v1/dpp-components.
 *
 * @param data - DppPublicData from getDppByProductUpid or getDppByVariantUpid
 * @returns DppData for frontend components
 */
export function transformToDppData(data: DppPublicData): DppData {
  return {
    title: data.productName,
    brandName: data.brandName,
    productImage: data.productImage ?? "",
    description: data.productDescription ?? "",
    size: data.sizeName ?? "",
    color: data.colorName ?? "",
    category: data.categoryName ?? "", // Just use the assigned category name
    articleNumber: data.productIdentifier,
    manufacturer: data.manufacturerName ?? "",
    countryOfOrigin: getCountryName(data.manufacturerCountryCode), // Full country name
    materials: data.materials.map((m) => ({
      percentage: m.percentage,
      type: m.materialName,
      origin: getCountryName(m.countryOfOrigin), // Full country name
      certification: m.certificationTitle ?? undefined,
      certificationUrl: m.certificationUrl ?? undefined,
    })),
    journey: data.journey.map((step) => ({
      name: formatStepType(step.stepType),
      companies: step.facilities.map((f) => ({
        name: f.displayName,
        location: [f.city, getCountryName(f.countryCode)].filter(Boolean).join(", "), // Full country name
      })),
    })),
    impactMetrics: buildImpactMetrics(data.environment),
    impactClaims: data.ecoClaims,
    similarProducts: [], // Future: from brand_carousel_products table
  };
}

