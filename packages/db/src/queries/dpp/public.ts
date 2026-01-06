/**
 * Public DPP (Digital Product Passport) Query Functions
 *
 * These queries fetch all data needed for public-facing DPP pages.
 * They are designed to be called server-side with serviceDb (bypasses RLS).
 *
 * URL Structure:
 * - Product-level: /:brandSlug/:productHandle
 * - Variant-level: /:brandSlug/:productHandle/:variantUpid
 */

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { ThemeConfig, ThemeStyles } from "@v1/dpp-components";
import type { Database } from "../../client";
import {
  products,
  productVariants,
  productVariantAttributes,
  productMaterials,
  productJourneySteps,
  productEnvironment,
  productEcoClaims,
  variantMaterials,
  variantJourneySteps,
  variantEnvironment,
  variantEcoClaims,
  brands,
  brandTheme,
  brandMaterials,
  brandCertifications,
  brandFacilities,
  brandEcoClaims,
  brandAttributes,
  brandAttributeValues,
  taxonomyCategories,
  brandManufacturers,
} from "../../schema";

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
 * Variant attribute for DPP display.
 */
export interface DppVariantAttribute {
  name: string;
  value: string;
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
  productName: string;
  productDescription: string | null;
  productImage: string | null;
  productHandle: string;
  productStatus: string;

  // ─────────────────────────────────────────────────────────────
  // Variant Data (null/empty if product-level DPP)
  // ─────────────────────────────────────────────────────────────
  variantId: string | null;
  variantUpid: string | null;
  /** Variant attributes (generic name/value pairs, 0-3 items) */
  variantAttributes: DppVariantAttribute[];
  /** Stock Keeping Unit (variant-level) */
  variantSku: string | null;
  /** Global Trade Item Number (variant-level) */
  variantGtin: string | null;
  /** European Article Number (variant-level) */
  variantEan: string | null;
  /** Barcode (variant-level) */
  variantBarcode: string | null;

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
  // Manufacturer
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
  productName: string;
  productDescription: string | null;
  productImage: string | null;
  productHandle: string;
  productStatus: string;
  variantId: string | null;
  variantUpid: string | null;
  variantAttributes: DppVariantAttribute[];
  variantSku: string | null;
  variantGtin: string | null;
  variantEan: string | null;
  variantBarcode: string | null;
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
 * Helper: Fetch variant attributes for a variant.
 */
async function fetchVariantAttributes(
  db: Database,
  variantId: string,
): Promise<DppVariantAttribute[]> {
  const rows = await db
    .select({
      name: brandAttributes.name,
      value: brandAttributeValues.name,
      sortOrder: productVariantAttributes.sortOrder,
    })
    .from(productVariantAttributes)
    .innerJoin(
      brandAttributeValues,
      eq(productVariantAttributes.attributeValueId, brandAttributeValues.id)
    )
    .innerJoin(
      brandAttributes,
      eq(brandAttributeValues.attributeId, brandAttributes.id)
    )
    .where(eq(productVariantAttributes.variantId, variantId))
    .orderBy(asc(productVariantAttributes.sortOrder));

  return rows.map((r) => ({ name: r.name, value: r.value }));
}

/**
 * Stage 1: Fetch core product/variant data with essential JOINs.
 * Includes published status check.
 * Looks up brand by slug and product by handle.
 * 
 * URL structure: /[brandSlug]/[productHandle]/[variantUpid]
 */
async function fetchCoreData(
  db: Database,
  brandSlug: string,
  productHandle: string,
  variantUpid?: string,
): Promise<CoreDataResult | null> {
  if (variantUpid) {
    // Variant-level query - includes variant override columns
    const rows = await db
      .select({
        // Product (base values)
        productId: products.id,
        productNameBase: products.name,
        productDescriptionBase: products.description,
        productImageBase: products.imagePath,
        productHandle: products.productHandle,
        productStatus: products.status,
        // Variant core data
        variantId: productVariants.id,
        variantUpid: productVariants.upid,
        // Variant override columns (for inheritance)
        variantName: productVariants.name,
        variantDescription: productVariants.description,
        variantImage: productVariants.imagePath,
        // Variant identifiers for article number
        variantSku: productVariants.sku,
        variantGtin: sql<string | null>`CAST(NULL AS TEXT)`.as("variantGtin"),
        variantEan: sql<string | null>`CAST(NULL AS TEXT)`.as("variantEan"),
        variantBarcode: productVariants.barcode,
        // Brand
        brandId: brands.id,
        brandName: brands.name,
        brandSlug: brands.slug,
        // Category
        categoryId: products.categoryId,
        categoryName: taxonomyCategories.name,
        // Manufacturer
        manufacturerName: brandManufacturers.name,
        manufacturerCountryCode: brandManufacturers.countryCode,
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
      .leftJoin(taxonomyCategories, eq(taxonomyCategories.id, products.categoryId))
      .leftJoin(brandManufacturers, eq(brandManufacturers.id, products.manufacturerId))
      .where(
        and(
          eq(brands.slug, brandSlug),
          eq(products.productHandle, productHandle),
          eq(productVariants.upid, variantUpid),
          eq(products.status, "published"),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    // Fetch variant display attributes (Color, Size, etc.)
    const variantDisplayAttributes = await fetchVariantAttributes(db, row.variantId);

    // Apply inheritance: variant value ?? product value
    return {
      productId: row.productId,
      productName: row.variantName ?? row.productNameBase,
      productDescription: row.variantDescription ?? row.productDescriptionBase,
      productImage: row.variantImage ?? row.productImageBase,
      productHandle: row.productHandle,
      productStatus: row.productStatus,
      variantId: row.variantId,
      variantUpid: row.variantUpid,
      variantAttributes: variantDisplayAttributes,
      variantSku: row.variantSku,
      variantGtin: row.variantGtin ?? null,
      variantEan: row.variantEan ?? null,
      variantBarcode: row.variantBarcode,
      brandId: row.brandId,
      brandName: row.brandName,
      brandSlug: row.brandSlug,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      manufacturerName: row.manufacturerName,
      manufacturerCountryCode: row.manufacturerCountryCode,
      themeConfig: row.themeConfig,
      themeStyles: row.themeStyles,
      stylesheetPath: row.stylesheetPath,
      googleFontsUrl: row.googleFontsUrl,
    } as CoreDataResult;
  }

  // Product-level query (no variant identifiers - article number not shown)
  const rows = await db
    .select({
      productId: products.id,
      productName: products.name,
      productDescription: products.description,
      productImage: products.imagePath,
      productHandle: products.productHandle,
      productStatus: products.status,
      brandId: brands.id,
      brandName: brands.name,
      brandSlug: brands.slug,
      categoryId: products.categoryId,
      categoryName: taxonomyCategories.name,
      manufacturerName: brandManufacturers.name,
      manufacturerCountryCode: brandManufacturers.countryCode,
      themeConfig: brandTheme.themeConfig,
      themeStyles: brandTheme.themeStyles,
      stylesheetPath: brandTheme.stylesheetPath,
      googleFontsUrl: brandTheme.googleFontsUrl,
    })
    .from(products)
    .innerJoin(brands, eq(brands.id, products.brandId))
    .leftJoin(brandTheme, eq(brandTheme.brandId, products.brandId))
    .leftJoin(taxonomyCategories, eq(taxonomyCategories.id, products.categoryId))
    .leftJoin(brandManufacturers, eq(brandManufacturers.id, products.manufacturerId))
    .where(
      and(
        eq(brands.slug, brandSlug),
        eq(products.productHandle, productHandle),
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
    variantAttributes: [],
    variantSku: null,
    variantGtin: null,
    variantEan: null,
    variantBarcode: null,
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
      journeyStepId: productJourneySteps.id,
      displayName: brandFacilities.displayName,
      city: brandFacilities.city,
      countryCode: brandFacilities.countryCode,
    })
    .from(productJourneySteps)
    .innerJoin(
      brandFacilities,
      eq(brandFacilities.id, productJourneySteps.facilityId),
    )
    .where(inArray(productJourneySteps.id, stepIds));

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
          certificationUrl: brandCertifications.instituteWebsite,
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
          value: productEnvironment.value,
          unit: productEnvironment.unit,
          metric: productEnvironment.metric,
        })
        .from(productEnvironment)
        .where(eq(productEnvironment.productId, productId)),

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
    environment: environmentRows.length > 0
      ? {
        carbonKgCo2e: environmentRows.find((e) => e.metric === "carbon_kg_co2e")?.value
          ? String(environmentRows.find((e) => e.metric === "carbon_kg_co2e")!.value)
          : null,
        waterLiters: environmentRows.find((e) => e.metric === "water_liters")?.value
          ? String(environmentRows.find((e) => e.metric === "water_liters")!.value)
          : null,
      }
      : null,
    ecoClaims: ecoClaimRows.map((c) => c.claim),
  };
}

/**
 * Helper: Fetch variant journey steps with their associated facilities.
 * Uses batch loading to avoid N+1 queries.
 */
async function fetchVariantJourneyWithFacilities(
  db: Database,
  variantId: string,
): Promise<DppJourneyStep[]> {
  // Get journey steps from variant table
  const steps = await db
    .select({
      id: variantJourneySteps.id,
      sortIndex: variantJourneySteps.sortIndex,
      stepType: variantJourneySteps.stepType,
    })
    .from(variantJourneySteps)
    .where(eq(variantJourneySteps.variantId, variantId))
    .orderBy(asc(variantJourneySteps.sortIndex));

  if (steps.length === 0) return [];

  // Get all facilities for these steps in one query
  const stepIds = steps.map((s) => s.id);
  const facilityRows = await db
    .select({
      journeyStepId: variantJourneySteps.id,
      displayName: brandFacilities.displayName,
      city: brandFacilities.city,
      countryCode: brandFacilities.countryCode,
    })
    .from(variantJourneySteps)
    .innerJoin(
      brandFacilities,
      eq(brandFacilities.id, variantJourneySteps.facilityId),
    )
    .where(inArray(variantJourneySteps.id, stepIds));

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
 * Stage 2b: Fetch variant-level override data with full DPP details.
 * Used for variant-level DPP rendering with inheritance.
 * Returns null for each field if no variant-level data exists.
 */
async function fetchVariantOverrideData(
  db: Database,
  variantId: string,
): Promise<ProductAttributes | null> {
  const [materials, journey, environmentRows, ecoClaimRows] = await Promise.all(
    [
      // Variant materials with certification info
      db
        .select({
          percentage: variantMaterials.percentage,
          materialName: brandMaterials.name,
          countryOfOrigin: brandMaterials.countryOfOrigin,
          recyclable: brandMaterials.recyclable,
          certificationTitle: brandCertifications.title,
          certificationUrl: brandCertifications.instituteWebsite,
        })
        .from(variantMaterials)
        .innerJoin(
          brandMaterials,
          eq(brandMaterials.id, variantMaterials.brandMaterialId),
        )
        .leftJoin(
          brandCertifications,
          eq(brandCertifications.id, brandMaterials.certificationId),
        )
        .where(eq(variantMaterials.variantId, variantId))
        .orderBy(asc(variantMaterials.createdAt)),

      // Variant journey steps with facilities
      fetchVariantJourneyWithFacilities(db, variantId),

      // Variant environment metrics
      db
        .select({
          carbonKgCo2e: variantEnvironment.carbonKgCo2e,
          waterLiters: variantEnvironment.waterLiters,
        })
        .from(variantEnvironment)
        .where(eq(variantEnvironment.variantId, variantId))
        .limit(1),

      // Variant eco claims
      db
        .select({
          claim: brandEcoClaims.claim,
        })
        .from(variantEcoClaims)
        .innerJoin(
          brandEcoClaims,
          eq(brandEcoClaims.id, variantEcoClaims.ecoClaimId),
        )
        .where(eq(variantEcoClaims.variantId, variantId)),
    ],
  );

  // Check if ANY variant-level data exists for each category
  const hasMaterials = materials.length > 0;
  const hasJourney = journey.length > 0;
  const hasEnvironment = environmentRows.length > 0;
  const hasEcoClaims = ecoClaimRows.length > 0;

  // If no variant data exists at all, return null to signal full inheritance
  if (!hasMaterials && !hasJourney && !hasEnvironment && !hasEcoClaims) {
    return null;
  }

  return {
    // Only include if variant has overrides, otherwise null triggers inheritance
    materials: hasMaterials
      ? materials.map((m) => ({
        percentage: m.percentage ? Number(m.percentage) : 0,
        materialName: m.materialName,
        countryOfOrigin: m.countryOfOrigin,
        recyclable: m.recyclable,
        certificationTitle: m.certificationTitle,
        certificationUrl: m.certificationUrl,
      }))
      : [],
    journey: hasJourney ? journey : [],
    environment: hasEnvironment && environmentRows[0]
      ? {
        carbonKgCo2e: environmentRows[0].carbonKgCo2e
          ? String(environmentRows[0].carbonKgCo2e)
          : null,
        waterLiters: environmentRows[0].waterLiters
          ? String(environmentRows[0].waterLiters)
          : null,
      }
      : null,
    ecoClaims: hasEcoClaims ? ecoClaimRows.map((c) => c.claim) : [],
  };
}

/**
 * Resolve attributes with variant-level inheritance.
 * For each category: use variant data if exists, else fall back to product data.
 */
async function resolveVariantAttributesWithInheritance(
  db: Database,
  variantId: string,
  productId: string,
): Promise<ProductAttributes> {
  // Fetch both variant and product attributes in parallel
  const [variantAttrs, productAttrs] = await Promise.all([
    fetchVariantOverrideData(db, variantId),
    fetchProductAttributes(db, productId),
  ]);

  // If no variant overrides exist, use product attributes entirely
  if (!variantAttrs) {
    return productAttrs;
  }

  // Apply inheritance: variant data takes precedence, fall back to product
  return {
    materials: variantAttrs.materials.length > 0
      ? variantAttrs.materials
      : productAttrs.materials,
    journey: variantAttrs.journey.length > 0
      ? variantAttrs.journey
      : productAttrs.journey,
    environment: variantAttrs.environment ?? productAttrs.environment,
    ecoClaims: variantAttrs.ecoClaims.length > 0
      ? variantAttrs.ecoClaims
      : productAttrs.ecoClaims,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// Public Query Functions
// ─────────────────────────────────────────────────────────────────────────────


/**
 * Fetch complete DPP data for a product-level passport.
 * URL structure: /[brandSlug]/[productHandle]/
 *
 * @param db - Database instance (use serviceDb for bypassing RLS)
 * @param brandSlug - Brand slug (URL-friendly identifier)
 * @param productHandle - Product handle (brand-defined identifier used in URL)
 * @returns DppPublicData or null if not found/not published
 */
export async function getDppByProductHandle(
  db: Database,
  brandSlug: string,
  productHandle: string,
): Promise<DppPublicData | null> {
  // Stage 1: Core data
  const core = await fetchCoreData(db, brandSlug, productHandle);
  if (!core) return null;

  // Stage 2: Attributes
  const attributes = await fetchProductAttributes(db, core.productId);

  return {
    sourceType: "product",
    productId: core.productId,
    productName: core.productName,
    productDescription: core.productDescription,
    productImage: core.productImage,
    productHandle: core.productHandle,
    productStatus: core.productStatus,
    variantId: null,
    variantUpid: null,
    variantAttributes: [],
    // No article number at product level - only shown for variants
    variantSku: null,
    variantGtin: null,
    variantEan: null,
    variantBarcode: null,
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
 * URL structure: /[brandSlug]/[productHandle]/[variantUpid]/
 *
 * @param db - Database instance (use serviceDb for bypassing RLS)
 * @param brandSlug - Brand slug (URL-friendly identifier)
 * @param productHandle - Product handle (brand-defined identifier used in URL)
 * @param variantUpid - Variant UPID (16-char alphanumeric)
 * @returns DppPublicData or null if not found/not published
 */
export async function getDppByVariantUpid(
  db: Database,
  brandSlug: string,
  productHandle: string,
  variantUpid: string,
): Promise<DppPublicData | null> {
  // Stage 1: Core data (includes variant info with inheritance for name/description/image)
  const core = await fetchCoreData(db, brandSlug, productHandle, variantUpid);
  if (!core) return null;

  // Stage 2: Attributes with variant-level inheritance
  // For each category: use variant data if exists, else fall back to product data
  const attributes = await resolveVariantAttributesWithInheritance(
    db,
    core.variantId!,
    core.productId,
  );

  return {
    sourceType: "variant",
    productId: core.productId,
    productName: core.productName,
    productDescription: core.productDescription,
    productImage: core.productImage,
    productHandle: core.productHandle,
    productStatus: core.productStatus,
    variantId: core.variantId,
    variantUpid: core.variantUpid,
    variantAttributes: core.variantAttributes,
    // Variant identifiers for article number (barcode > GTIN > EAN > SKU precedence)
    variantSku: core.variantSku,
    variantGtin: core.variantGtin,
    variantEan: core.variantEan,
    variantBarcode: core.variantBarcode,
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
 * Format a numeric string by removing trailing zeros.
 * Example: "88.4500" → "88.45", "100.0000" → "100"
 */
function formatNumber(value: string): string {
  const num = Number.parseFloat(value);
  if (Number.isNaN(num)) return value;
  // Use toLocaleString for nice formatting, or just remove trailing zeros
  return num.toString();
}

// DppData type is now imported from @v1/dpp-components

// ─────────────────────────────────────────────────────────────────────────────
// Public Carousel Query
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Carousel product for public DPP display.
 */
export interface PublicCarouselProduct {
  id: string;
  name: string;
  imagePath: string | null;
  price: string;
  currency: string;
  webshopUrl: string;
}

/**
 * Fetch carousel products for public DPP display.
 * Resolves brand by slug and product by handle, then fetches carousel
 * based on theme config settings.
 *
 * @param db - Database instance (use serviceDb for bypassing RLS)
 * @param brandSlug - Brand slug (URL-friendly identifier)
 * @param currentProductHandle - Current product handle to exclude from carousel
 * @param limit - Maximum number of products (default 8, max 20)
 * @returns Array of carousel products or empty array if brand/product not found
 */
export async function getCarouselProductsForDpp(
  db: Database,
  brandSlug: string,
  currentProductHandle: string,
  limit = 8,
): Promise<PublicCarouselProduct[]> {
  // First, resolve the brand and product
  const brandRows = await db
    .select({
      brandId: brands.id,
      themeConfig: brandTheme.themeConfig,
    })
    .from(brands)
    .leftJoin(brandTheme, eq(brandTheme.brandId, brands.id))
    .where(eq(brands.slug, brandSlug))
    .limit(1);

  const brand = brandRows[0];
  if (!brand) return [];

  // Get the current product to exclude and get its category
  const productRows = await db
    .select({
      id: products.id,
      categoryId: products.categoryId,
    })
    .from(products)
    .where(
      and(
        eq(products.brandId, brand.brandId),
        eq(products.productHandle, currentProductHandle),
        eq(products.status, "published"),
      ),
    )
    .limit(1);

  const currentProduct = productRows[0];
  if (!currentProduct) return [];

  // Extract carousel config from theme
  const themeConfig = brand.themeConfig as Record<string, unknown> | null;
  const carouselConfig = themeConfig?.carousel as {
    productCount?: number;
    filter?: Record<string, unknown>;
    includeIds?: string[];
    excludeIds?: string[];
  } | null;

  // Use the existing fetchCarouselProducts function
  const { fetchCarouselProducts } = await import("./carousel.js");

  const carouselProducts = await fetchCarouselProducts(db, {
    brandId: brand.brandId,
    currentProductId: currentProduct.id,
    currentCategoryId: currentProduct.categoryId,
    carouselConfig: carouselConfig
      ? {
        ...carouselConfig,
        productCount: Math.min(limit, carouselConfig.productCount ?? limit, 20),
      }
      : { productCount: Math.min(limit, 20) },
  });

  return carouselProducts;
}

// transformToDppData has been moved to ./transform.ts
export { transformToDppData } from "./transform";

