# Digital Product Passport URL & Architecture Plan

---

## Executive Summary

This document outlines the architecture for public-facing Digital Product Passport (DPP) pages that support both **product-level** and **variant-level** access. The key insight is to use a **hierarchical URL structure** that eliminates the need for complex cross-table UPID uniqueness constraints.

### URL Structure (Final Decision)

```
Product-level:  /:brandId/:productUpid
Variant-level:  /:brandId/:productUpid/:variantUpid
```

This structure:
- Eliminates cross-table UPID uniqueness requirements
- Encodes parent-child relationships explicitly
- Simplifies data fetching and validation
- Provides clean analytics grouping

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [URL Architecture](#2-url-architecture)
3. [Schema Changes](#3-schema-changes)
4. [Data Fetching Strategy](#4-data-fetching-strategy)
5. [Security Architecture](#5-security-architecture)
6. [API Layer Decision](#6-api-layer-decision)
7. [Performance Considerations](#7-performance-considerations)
8. [Implementation Phases](#8-implementation-phases)
9. [Business Rules](#9-business-rules)
10. [Open Questions](#10-open-questions)

---

## 1. Current State Analysis

### What Exists Today

| Component | Current Implementation |
|-----------|----------------------|
| **Product UPID** | `products.upid` - unique within brand via `idx_products_brand_upid` |
| **Variant UPID** | `product_variants.upid` - unique within brand via `idx_unique_upid_per_brand` |
| **Brand Identifier** | `brands.id` (UUID) - no slug column exists |
| **DPP Page** | Only looks up variants at `/[brand]/[upid]` |
| **Data Fetching** | 4 sequential Supabase queries in `apps/dpp` |
| **RLS Policies** | Authenticated/service_role only - no public access |

### Current Schema Summary

**Products Table** (`packages/db/src/schema/products/products.ts`):
- `upid`: text, nullable
- `status`: text, defaults to 'unpublished'
- Index: `idx_products_brand_upid` on (brand_id, upid)
- RLS: Only brand members can access

**Product Variants Table** (`packages/db/src/schema/products/product-variants.ts`):
- `upid`: text, nullable
- Index: `idx_product_variants_upid` (conditional on upid IS NOT NULL)
- RLS: Inherited through products relationship

### Problems with Single-Segment UPID Approach

1. **Cross-table uniqueness**: Would require triggers or registry table
2. **Race conditions**: Triggers have TOCTOU vulnerabilities under concurrency
3. **Ambiguity**: Cannot distinguish product vs variant from URL alone
4. **Complexity**: Additional tables or complex constraints needed

---

## 2. URL Architecture

### Chosen Approach: Hierarchical Two-Segment URLs

```
Product-level DPP:  https://passport.avelero.com/:brandId/:productUpid
Variant-level DPP:  https://passport.avelero.com/:brandId/:productUpid/:variantUpid
```

### Why This Works

| Benefit | Explanation |
|---------|-------------|
| **No cross-table uniqueness** | Namespaces are separate: product UPID unique per brand, variant UPID unique per product |
| **Explicit hierarchy** | URL structure shows parent-child relationship |
| **Simple validation** | Each lookup uses indexed columns with proper uniqueness |
| **Analytics-friendly** | Easy grouping by product or variant |
| **SEO-friendly** | Meaningful URL structure |

### Examples

```
# Product-level (no variants or brand prefers product-level)
https://passport.avelero.com/9f8e7d6c-5b4a-3210-9876-543210fedcba/air-force-1

# Variant-level (specific color/size combination)
https://passport.avelero.com/9f8e7d6c-5b4a-3210-9876-543210fedcba/air-force-1/white-42

# With short UPIDs (actual format)
https://passport.avelero.com/9f8e7d6c-5b4a-3210-9876-543210fedcba/abc123def456/xyz789
```

### QR Code Consideration

For physical product QR codes that need maximum brevity, we can:
1. Use the full hierarchical URL (acceptable for most use cases)
2. Implement a redirect service: `passport.avelero.com/q/xyz789` → full URL

---

## 3. Schema Changes

### 3.1 Add Brand Slug (Optional but Recommended)

To enable human-readable URLs like `/nike/air-force-1/white-42`:

```sql
-- Migration: Add slug column to brands
ALTER TABLE brands ADD COLUMN slug text;
CREATE UNIQUE INDEX idx_brands_slug ON brands (slug) WHERE slug IS NOT NULL;

-- Backfill existing brands with slugified names
UPDATE brands SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'));
```

**Decision Point**: For MVP, we can use brand UUID. Slug can be added later for nicer URLs.

### 3.2 Simplify UPID Uniqueness Constraints

Remove cross-table uniqueness complexity. Use simple per-table constraints:

```sql
-- Products: UPID unique within brand (already exists via idx_products_brand_upid)
-- No changes needed

-- Variants: UPID unique within PRODUCT (not brand!)
-- This is a CHANGE from current behavior
DROP INDEX IF EXISTS idx_unique_upid_per_brand;

CREATE UNIQUE INDEX idx_product_variants_upid_per_product 
ON product_variants (product_id, upid) 
WHERE upid IS NOT NULL AND upid != '';
```

### 3.3 Drizzle Schema Updates

**`packages/db/src/schema/products/product-variants.ts`** changes:

```typescript
// Replace the current index with:
uniqueIndex("idx_product_variants_upid_per_product")
  .on(table.productId, table.upid)
  .where(sql`(upid IS NOT NULL AND upid != '')`),
```

### 3.4 Public Access RLS Policies

Add policies for anonymous/public read access to published products:

```sql
-- Products: Allow public read of published products
CREATE POLICY "products_public_select" ON products
FOR SELECT TO anon
USING (status = 'published');

-- Variants: Allow public read when parent product is published
CREATE POLICY "product_variants_public_select" ON product_variants
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM products 
    WHERE products.id = product_id 
    AND products.status = 'published'
  )
);

-- Brand theme: Allow public read (always needed for styling)
CREATE POLICY "brand_theme_public_select" ON brand_theme
FOR SELECT TO anon
USING (true);

-- Brand colors/sizes: Allow public read for DPP display
CREATE POLICY "brand_colors_public_select" ON brand_colors
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM products p
    JOIN product_variants pv ON pv.product_id = p.id
    WHERE pv.color_id = brand_colors.id
    AND p.status = 'published'
  )
);

CREATE POLICY "brand_sizes_public_select" ON brand_sizes
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM products p
    JOIN product_variants pv ON pv.product_id = p.id
    WHERE pv.size_id = brand_sizes.id
    AND p.status = 'published'
  )
);
```

---

## 4. Data Fetching Strategy

### 4.1 Data Model: Mapping Database to DPP Display

The public DPP page needs to display data from multiple tables. Here's how the **database schema** maps to the **DppData interface** used by the frontend:

| DppData Field | Source Table(s) | Database Column(s) |
|---------------|-----------------|-------------------|
| `title` | products | `name` |
| `brandName` | brands | `name` |
| `productImage` | products | `primary_image_url` |
| `description` | products | `description` |
| `size` | brand_sizes (via variant) | `name` |
| `color` | brand_colors (via variant) | `name` |
| `category` | categories | `name` (with parent hierarchy) |
| `articleNumber` | products | `product_identifier` |
| `manufacturer` | showcase_brands | `name` |
| `countryOfOrigin` | showcase_brands | `country_code` |
| `materials[]` | product_materials + brand_materials + brand_certifications | `percentage`, `name`, `country_of_origin`, `recyclable`, certification title/url |
| `journey[]` | product_journey_steps + product_journey_step_facilities + brand_facilities | `step_type`, `sort_index`, facility `display_name`, `city`, `country_code` |
| `impactMetrics[]` | product_environment | `carbon_kg_co2e`, `water_liters` |
| `impactClaims[]` | product_eco_claims + brand_eco_claims | `claim` |
| `similarProducts[]` | **TBD** - Future external products table | `title`, `image_url`, `price`, `webshop_url` |

### 4.2 Complete Data Interfaces

```typescript
// packages/db/src/queries/dpp-public.ts

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
  stepType: string; // e.g., 'raw_material', 'manufacturing', 'assembly', 'distribution'
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
 * Similar/related product for carousel display
 * NOTE: This will come from a future external products table (not yet created)
 * containing products with webshop links, not internal passport products
 */
export interface DppSimilarProduct {
  title: string;
  imageUrl: string;
  price: number;
  currency: string;
  webshopUrl: string;
}
// TODO: Create `brand_carousel_products` table with these fields

/**
 * Complete data structure for public DPP rendering
 * This is the single object returned by the DPP query functions
 */
export interface DppPublicData {
  // ─────────────────────────────────────────────────────────────
  // Source Identification
  // ─────────────────────────────────────────────────────────────
  sourceType: 'product' | 'variant';
  
  // ─────────────────────────────────────────────────────────────
  // Product Core Data (always present)
  // ─────────────────────────────────────────────────────────────
  productId: string;
  productUpid: string;
  productName: string;
  productDescription: string | null;
  productImage: string | null;
  productIdentifier: string; // Article number
  productStatus: string;
  
  // ─────────────────────────────────────────────────────────────
  // Variant Data (null if product-level DPP)
  // ─────────────────────────────────────────────────────────────
  variantId: string | null;
  variantUpid: string | null;
  colorId: string | null;
  colorName: string | null;
  sizeId: string | null;
  sizeName: string | null;
  
  // ─────────────────────────────────────────────────────────────
  // Brand Data
  // ─────────────────────────────────────────────────────────────
  brandId: string;
  brandName: string;
  
  // ─────────────────────────────────────────────────────────────
  // Category (hierarchical path)
  // ─────────────────────────────────────────────────────────────
  categoryId: string | null;
  categoryName: string | null;
  categoryPath: string[] | null; // e.g., ['Clothing', 'Outerwear', 'Jackets']
  
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
  ecoClaims: string[]; // Array of claim texts
  
  // ─────────────────────────────────────────────────────────────
  // Similar Products (for carousel) - FUTURE IMPLEMENTATION
  // Will come from a separate external products table (not yet created)
  // ─────────────────────────────────────────────────────────────
  similarProducts: DppSimilarProduct[]; // Empty array until table is created
  
  // ─────────────────────────────────────────────────────────────
  // Theme Configuration (for rendering)
  // ─────────────────────────────────────────────────────────────
  themeConfig: ThemeConfig | null;
  themeStyles: ThemeStyles | null;
  stylesheetPath: string | null;
  googleFontsUrl: string | null;
}

/**
 * ThemeConfig structure (from @v1/dpp-components)
 * Controls layout, visibility, and content of DPP sections
 */
export interface ThemeConfig {
  branding: {
    headerLogoUrl: string;
  };
  menus: {
    primary: Array<{ label: string; url: string }>;
    secondary: Array<{ label: string; url: string }>;
  };
  cta: {
    bannerBackgroundImage: string;
    bannerHeadline: string;
    bannerSubline: string;
    bannerCTAText: string;
    bannerCTAUrl: string;
  };
  social: {
    showInstagram: boolean;
    showFacebook: boolean;
    showTwitter: boolean;
    showPinterest: boolean;
    showTiktok: boolean;
    showLinkedin: boolean;
    instagramUrl: string;
    facebookUrl: string;
    twitterUrl: string;
    pinterestUrl: string;
    tiktokUrl: string;
    linkedinUrl: string;
  };
  sections: {
    showProductDetails: boolean;
    showPrimaryMenu: boolean;
    showSecondaryMenu: boolean;
    showImpact: boolean;
    showMaterials: boolean;
    showJourney: boolean;
    showSimilarProducts: boolean;
    showCTABanner: boolean;
  };
  materials: {
    showCertificationCheckIcon: boolean;
  };
}

/**
 * ThemeStyles structure (from @v1/dpp-components)
 * Design tokens for visual styling
 */
export interface ThemeStyles {
  // Font configuration, colors, spacing, etc.
  // (imported from @v1/dpp-components)
  customFonts?: unknown; // For @font-face generation
}
```

### 4.3 Query Strategy: Two-Stage Fetch

Due to the complexity of the data model (many-to-many relationships, hierarchical categories), we use a **two-stage fetch pattern**:

```
Stage 1: Core Data (Single Query with JOINs)
├── Product base data
├── Variant data (if variant-level)
├── Brand data
├── Theme data
├── Category (leaf node)
└── Showcase brand (manufacturer)

Stage 2: Attributes (Parallel Queries)
├── Materials (with certifications)
├── Journey steps (with facilities)
├── Environment metrics
└── Eco claims

Future: Similar Products
└── Will be fetched from a separate external products table (not yet created)
    This table will contain curated products with webshop links
```

### 4.4 Query Implementation

### 4.5 Query Implementation

```typescript
// packages/db/src/queries/dpp-public.ts

import { and, eq, inArray, asc } from 'drizzle-orm';
import type { Database } from '../client';
import {
  products, productVariants, productMaterials, productJourneySteps,
  productJourneyStepFacilities, productEcoClaims, productEnvironment,
} from '../schema/products';
import {
  brands, brandTheme, brandColors, brandSizes, brandMaterials,
  brandCertifications, brandEcoClaims, brandFacilities, categories,
  showcaseBrands,
} from '../schema';

/**
 * Stage 1: Fetch core product/variant data with essential JOINs
 */
async function fetchCoreData(
  db: Database,
  brandId: string,
  productUpid: string,
  variantUpid?: string,
): Promise<CoreDataResult | null> {
  
  if (variantUpid) {
    // Variant-level query
    const [result] = await db
      .select({
        // Product
        productId: products.id,
        productUpid: products.upid,
        productName: products.name,
        productDescription: products.description,
        productImage: products.primaryImageUrl,
        productIdentifier: products.productIdentifier,
        productStatus: products.status,
        // Variant
        variantId: productVariants.id,
        variantUpid: productVariants.upid,
        colorId: productVariants.colorId,
        colorName: brandColors.name,
        sizeId: productVariants.sizeId,
        sizeName: brandSizes.name,
        // Brand
        brandId: brands.id,
        brandName: brands.name,
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
          eq(products.brandId, brandId),
          eq(products.upid, productUpid),
          eq(productVariants.upid, variantUpid),
          eq(products.status, 'published')
        )
      )
      .limit(1);
    
    return result ? { ...result, sourceType: 'variant' as const } : null;
  }
  
  // Product-level query
  const [result] = await db
    .select({
      productId: products.id,
      productUpid: products.upid,
      productName: products.name,
      productDescription: products.description,
      productImage: products.primaryImageUrl,
      productIdentifier: products.productIdentifier,
      productStatus: products.status,
      brandId: brands.id,
      brandName: brands.name,
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
        eq(products.brandId, brandId),
        eq(products.upid, productUpid),
        eq(products.status, 'published')
      )
    )
    .limit(1);
  
  return result ? {
    ...result,
    sourceType: 'product' as const,
    variantId: null,
    variantUpid: null,
    colorId: null,
    colorName: null,
    sizeId: null,
    sizeName: null,
  } : null;
}

/**
 * Stage 2: Fetch product attributes (materials, journey, environment, eco claims)
 */
async function fetchProductAttributes(
  db: Database,
  productId: string,
): Promise<ProductAttributes> {
  // Parallel queries for better performance
  const [materials, journeySteps, environment, ecoClaims] = await Promise.all([
    // Materials with certification info
    db.select({
      percentage: productMaterials.percentage,
      materialName: brandMaterials.name,
      countryOfOrigin: brandMaterials.countryOfOrigin,
      recyclable: brandMaterials.recyclable,
      certificationTitle: brandCertifications.title,
      certificationUrl: brandCertifications.externalUrl,
    })
    .from(productMaterials)
    .innerJoin(brandMaterials, eq(brandMaterials.id, productMaterials.brandMaterialId))
    .leftJoin(brandCertifications, eq(brandCertifications.id, brandMaterials.certificationId))
    .where(eq(productMaterials.productId, productId))
    .orderBy(asc(productMaterials.createdAt)),

    // Journey steps with facilities
    fetchJourneyWithFacilities(db, productId),

    // Environment metrics
    db.select({
      carbonKgCo2e: productEnvironment.carbonKgCo2e,
      waterLiters: productEnvironment.waterLiters,
    })
    .from(productEnvironment)
    .where(eq(productEnvironment.productId, productId))
    .limit(1),

    // Eco claims
    db.select({
      claim: brandEcoClaims.claim,
    })
    .from(productEcoClaims)
    .innerJoin(brandEcoClaims, eq(brandEcoClaims.id, productEcoClaims.ecoClaimId))
    .where(eq(productEcoClaims.productId, productId)),
  ]);

  return {
    materials: materials.map(m => ({
      percentage: m.percentage ? Number(m.percentage) : 0,
      materialName: m.materialName,
      countryOfOrigin: m.countryOfOrigin,
      recyclable: m.recyclable,
      certificationTitle: m.certificationTitle,
      certificationUrl: m.certificationUrl,
    })),
    journey: journeySteps,
    environment: environment[0] ?? null,
    ecoClaims: ecoClaims.map(c => c.claim),
  };
}

/**
 * Helper: Fetch journey steps with their associated facilities
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

  // Get all facilities for these steps
  const stepIds = steps.map(s => s.id);
  const facilityRows = await db
    .select({
      journeyStepId: productJourneyStepFacilities.journeyStepId,
      displayName: brandFacilities.displayName,
      city: brandFacilities.city,
      countryCode: brandFacilities.countryCode,
    })
    .from(productJourneyStepFacilities)
    .innerJoin(brandFacilities, eq(brandFacilities.id, productJourneyStepFacilities.facilityId))
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

  return steps.map(step => ({
    sortIndex: step.sortIndex,
    stepType: step.stepType,
    facilities: facilitiesByStep.get(step.id) ?? [],
  }));
}

// NOTE: Similar products will be fetched from a future external products table
// (brand_carousel_products or similar) containing curated items with webshop URLs
// For now, similarProducts will always be an empty array

/**
 * Main public function: Get complete DPP data by product UPID (product-level)
 */
export async function getDppByProductUpid(
  db: Database,
  brandId: string,
  productUpid: string,
): Promise<DppPublicData | null> {
  // Stage 1: Core data
  const core = await fetchCoreData(db, brandId, productUpid);
  if (!core) return null;

  // Stage 2: Attributes
  const attributes = await fetchProductAttributes(db, core.productId);

  // Build category path (would need recursive query for full hierarchy)
  // Simplified: just use category name for now
  const categoryPath = core.categoryName ? [core.categoryName] : null;

  return {
    sourceType: 'product',
    productId: core.productId,
    productUpid: core.productUpid!,
    productName: core.productName,
    productDescription: core.productDescription,
    productImage: core.productImage,
    productIdentifier: core.productIdentifier,
    productStatus: core.productStatus,
    variantId: null,
    variantUpid: null,
    colorId: null,
    colorName: null,
    sizeId: null,
    sizeName: null,
    brandId: core.brandId,
    brandName: core.brandName,
    categoryId: core.categoryId,
    categoryName: core.categoryName,
    categoryPath,
    manufacturerName: core.manufacturerName,
    manufacturerCountryCode: core.manufacturerCountryCode,
    materials: attributes.materials,
    journey: attributes.journey,
    environment: attributes.environment,
    ecoClaims: attributes.ecoClaims,
    similarProducts: [], // TODO: Fetch from future brand_carousel_products table
    themeConfig: core.themeConfig as ThemeConfig | null,
    themeStyles: core.themeStyles as ThemeStyles | null,
    stylesheetPath: core.stylesheetPath,
    googleFontsUrl: core.googleFontsUrl,
  };
}

/**
 * Main public function: Get complete DPP data by variant UPID (variant-level)
 */
export async function getDppByVariantUpid(
  db: Database,
  brandId: string,
  productUpid: string,
  variantUpid: string,
): Promise<DppPublicData | null> {
  // Stage 1: Core data (includes variant info)
  const core = await fetchCoreData(db, brandId, productUpid, variantUpid);
  if (!core) return null;

  // Stage 2: Attributes (same as product-level)
  const attributes = await fetchProductAttributes(db, core.productId);

  const categoryPath = core.categoryName ? [core.categoryName] : null;

  return {
    sourceType: 'variant',
    productId: core.productId,
    productUpid: core.productUpid!,
    productName: core.productName,
    productDescription: core.productDescription,
    productImage: core.productImage,
    productIdentifier: core.productIdentifier,
    productStatus: core.productStatus,
    variantId: core.variantId,
    variantUpid: core.variantUpid,
    colorId: core.colorId,
    colorName: core.colorName,
    sizeId: core.sizeId,
    sizeName: core.sizeName,
    brandId: core.brandId,
    brandName: core.brandName,
    categoryId: core.categoryId,
    categoryName: core.categoryName,
    categoryPath,
    manufacturerName: core.manufacturerName,
    manufacturerCountryCode: core.manufacturerCountryCode,
    materials: attributes.materials,
    journey: attributes.journey,
    environment: attributes.environment,
    ecoClaims: attributes.ecoClaims,
    similarProducts: [], // TODO: Fetch from future brand_carousel_products table
    themeConfig: core.themeConfig as ThemeConfig | null,
    themeStyles: core.themeStyles as ThemeStyles | null,
    stylesheetPath: core.stylesheetPath,
    googleFontsUrl: core.googleFontsUrl,
  };
}
```

### 4.6 Transforming DppPublicData to DppData

The DPP frontend components expect the `DppData` interface. Here's how to transform:

```typescript
// apps/dpp/src/utils/transform-dpp-data.ts

import type { DppData, Material, JourneyStage, ImpactMetric } from '@v1/dpp-components';
import type { DppPublicData } from '@v1/db/queries';

/**
 * Transform database query result to frontend display format
 */
export function transformToDppData(data: DppPublicData): DppData {
  return {
    // Core info
    title: data.productName,
    brandName: data.brandName,
    productImage: data.productImage ?? '',
    description: data.productDescription ?? '',
    
    // Variant-specific (empty if product-level)
    size: data.sizeName ?? '',
    color: data.colorName ?? '',
    
    // Category & identifiers
    category: data.categoryPath?.join(' > ') ?? data.categoryName ?? '',
    articleNumber: data.productIdentifier,
    
    // Manufacturer
    manufacturer: data.manufacturerName ?? '',
    countryOfOrigin: data.manufacturerCountryCode ?? '',
    
    // Materials
    materials: data.materials.map(m => ({
      percentage: m.percentage,
      type: m.materialName,
      origin: m.countryOfOrigin ?? '',
      certification: m.certificationTitle ?? undefined,
      certificationUrl: m.certificationUrl ?? undefined,
    })),
    
    // Journey
    journey: transformJourney(data.journey),
    
    // Impact
    impactMetrics: buildImpactMetrics(data.environment),
    impactClaims: data.ecoClaims,
    
    // Similar products (from future external products table)
    // For now, maps directly - when table is created, data will already be in correct format
    similarProducts: data.similarProducts.map(p => ({
      image: p.imageUrl,
      name: p.title,
      price: p.price,
      currency: p.currency,
      url: p.webshopUrl,
    })),
  };
}

function transformJourney(steps: DppPublicData['journey']): JourneyStage[] {
  return steps.map(step => ({
    name: formatStepType(step.stepType),
    companies: step.facilities.map(f => ({
      name: f.displayName,
      location: [f.city, f.countryCode].filter(Boolean).join(', '),
    })),
  }));
}

function formatStepType(stepType: string): string {
  // Convert snake_case to Title Case
  return stepType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function buildImpactMetrics(env: DppPublicData['environment']): ImpactMetric[] {
  const metrics: ImpactMetric[] = [];
  
  if (env?.carbonKgCo2e) {
    metrics.push({
      type: 'Carbon Footprint',
      value: env.carbonKgCo2e,
      unit: 'kg CO₂e',
      icon: 'factory',
    });
  }
  
  if (env?.waterLiters) {
    metrics.push({
      type: 'Water Usage',
      value: env.waterLiters,
      unit: 'liters',
      icon: 'drop',
    });
  }
  
  return metrics;
}
```

---

## 5. Security Architecture

### 5.1 Defense in Depth Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Edge Rate Limiting (Vercel/middleware)            │
│  - Per-IP limits with graceful degradation                  │
│  - Fallback allows requests if KV is down                   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Application Validation                            │
│  - Brand ID format validation                               │
│  - UPID format validation (16 chars, alphanumeric)          │
│  - Published status check in query                          │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Database RLS Policies                             │
│  - anon role with status='published' check                  │
│  - Only whitelisted columns exposed                         │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Rate Limiting with Fallback

```typescript
// apps/dpp/src/middleware.ts or in page.tsx
import { headers } from 'next/headers';
import { ratelimit } from '@v1/kv';

export async function rateLimit(): Promise<{ allowed: boolean; remaining?: number }> {
  try {
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0] ?? 'anonymous';
    
    // 60 requests per minute per IP
    const { success, remaining } = await ratelimit.limit(`dpp:${ip}`);
    return { allowed: success, remaining };
  } catch (error) {
    // KV is down - allow request but log
    console.error('Rate limiter unavailable:', error);
    return { allowed: true };
  }
}
```

### 5.3 Input Validation

```typescript
// Validate UPID format (16 chars, lowercase alphanumeric)
const UPID_REGEX = /^[a-z0-9]{16}$/;

function isValidUpid(upid: string): boolean {
  return UPID_REGEX.test(upid);
}

// Validate UUID format for brand ID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}
```

### 5.4 Content Security

Theme config and URLs must be validated on write (not read):

- `themeConfig`: Strict JSON schema validation
- `googleFontsUrl`: Must match `^https://fonts\.googleapis\.com/`
- `stylesheetPath`: Must be a valid Supabase storage path format

---

## 6. API Layer Decision

### Decision: Direct Database Access from DPP App

**Why NOT tRPC for public DPP pages:**

| Factor | tRPC | Direct DB |
|--------|------|-----------|
| Auth overhead | Requires context setup | None needed |
| Network hops | app → api → db | app → db |
| Caching | Complex | Simple (Next.js ISR) |
| Rate limiting | Need custom middleware | Easy in app |
| Code location | Split across apps | Self-contained |

**Rationale**: The DPP app is a **read-only public frontend**. Adding a tRPC hop adds latency and complexity without security benefits (RLS handles access control).

**However**, we should:
1. Create dedicated query functions in `@v1/db` (not reuse internal queries)
2. These functions only return public-safe fields
3. Keep internal management queries separate

### Alternative Considered: Public tRPC Router

If we later need:
- Centralized logging
- API versioning
- Rate limiting at API layer
- Multiple DPP frontends

Then create a `dppPublic` router in the API app. For now, direct DB is simpler.

---

## 7. Performance Considerations

### 7.1 Request Flow

```
User scans QR → passport.avelero.com/:brand/:product/:variant
       │
       ▼
┌─────────────────────────────────────┐
│  1. Rate limit check (Redis)        │  ~5ms (or skip if down)
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  2. Single DB query with JOINs      │  ~20-50ms
│     (product + variant + brand      │
│      + theme + colors + sizes)      │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  3. Server-render HTML with:        │  ~10ms
│     - CSS <link> in <head>          │
│     - Google Fonts <link>           │
│     - Fully populated content       │
└─────────────────────────────────────┘
       │
       ▼
    User receives fully-styled page (~50-100ms total)
```

### 7.2 Caching Strategy

**Phase 1 (MVP)**: No caching, always fresh queries
- Simple, avoids stale data issues
- Acceptable for current scale

**Phase 2 (Scale)**: Next.js ISR
```typescript
// Enable ISR with 60-second revalidation
export const revalidate = 60;
```

**Phase 3 (High Scale)**: Static generation on publish
- When product is published, generate static HTML
- Store in CDN/storage
- Instant load times

### 7.3 Database Indexes

Ensure these indexes exist for optimal query performance:

```sql
-- Product lookup by brand + upid (exists)
CREATE INDEX idx_products_brand_upid ON products (brand_id, upid);

-- Variant lookup by product + upid (NEW)
CREATE UNIQUE INDEX idx_product_variants_upid_per_product 
ON product_variants (product_id, upid) 
WHERE upid IS NOT NULL AND upid != '';

-- Theme lookup by brand (exists)
-- idx_brand_theme_updated_at covers this
```

---

## 8. Implementation Phases

### Phase 1: Schema & Constraints (Database)

- [ ] Create migration: Change variant UPID uniqueness from per-brand to per-product
- [ ] Create migration: Add public RLS policies for products, variants, theme, colors, sizes
- [ ] Update Drizzle schema in `packages/db`
- [ ] Test: Variant UPIDs unique per product, not per brand
- [ ] Test: Anonymous can read published products

### Phase 2: Query Layer (packages/db)

- [ ] Create `packages/db/src/queries/dpp-public.ts`
- [ ] Implement `getDppByProductUpid()` 
- [ ] Implement `getDppByVariantUpid()`
- [ ] Export from `packages/db/src/queries/index.ts`
- [ ] Write unit tests for both query functions

### Phase 3: DPP App Updates (apps/dpp)

- [ ] Refactor routing structure:
  - `/[brandId]/[productUpid]/page.tsx` (product-level)
  - `/[brandId]/[productUpid]/[variantUpid]/page.tsx` (variant-level)
- [ ] Add rate limiting middleware with fallback
- [ ] Add input validation (UUID, UPID formats)
- [ ] Update `generateMetadata` for SEO
- [ ] Conditionally render color/size rows based on sourceType
- [ ] Add proper 404 handling

### Phase 4: Main App Integration (apps/app)

- [ ] Add "View DPP" link to passports table (product-level)
- [ ] Update bulk export to include variant-level URLs
- [ ] Ensure product UPID is auto-generated on product creation

### Phase 5: Testing & Hardening

- [ ] E2E tests: Product-level DPP access
- [ ] E2E tests: Variant-level DPP access
- [ ] E2E tests: Unpublished product returns 404
- [ ] E2E tests: Rate limiting works
- [ ] Load testing: Verify performance under concurrent access

---

## 9. Business Rules

### 9.1 UPID Generation

**Products**: UPID is auto-generated when product is created
- Format: 16-character lowercase alphanumeric
- Unique within brand

**Variants**: UPID is auto-generated when variant is created
- Format: 16-character lowercase alphanumeric
- Unique within product (NOT brand)

### 9.2 Access Levels

| Scenario | URL | Result |
|----------|-----|--------|
| Published product, product-level | `/:brand/:productUpid` | ✅ Show DPP (no color/size) |
| Published product, variant-level | `/:brand/:productUpid/:variantUpid` | ✅ Show DPP (with color/size) |
| Unpublished product | Any URL | ❌ 404 |
| Invalid brand ID | Any URL | ❌ 404 |
| Invalid UPID format | Any URL | ❌ 404 |
| Variant UPID on wrong product | `/:brand/:wrongProduct/:variantUpid` | ❌ 404 |

### 9.3 Product vs Variant DPP Choice

**Rule**: A brand can expose DPPs at either level:
- Product-level: Link directly to `/:brand/:productUpid`
- Variant-level: Link to `/:brand/:productUpid/:variantUpid`

**No restriction** on having both. Product-level shows the base product, variant-level shows specific SKU details.

### 9.4 What Happens When Brand is Deactivated?

- All products become inaccessible (status check in query)
- Consider adding `brands.active` flag with RLS check
- OR set all products to 'archived' status on brand deactivation

---

## 10. Open Questions

### 10.1 Brand Slug vs UUID in URL

**Current Plan**: Use brand UUID
- Pro: No new column needed
- Con: Ugly URLs

**Alternative**: Add brand slug
- Pro: Human-readable URLs (`/nike/air-force-1`)
- Con: Requires migration and unique constraint

**Recommendation**: Ship with UUID first, add slug as enhancement.

### 10.2 Short URL Redirect Service

For QR codes that need brevity:
```
passport.avelero.com/q/xyz789 → full hierarchical URL
```

**Decision**: Defer to Phase 2. Not needed for MVP.

### 10.3 Analytics Tracking

Should we track DPP page views?
- If yes: Add analytics event (PostHog/Mixpanel)
- If no: Skip for now

**Recommendation**: Add basic tracking from the start (page view with product/variant ID).

### 10.4 Materials/Journey/Impact Data

Current plan fetches basic product data. Should DPP show:
- Material composition
- Journey steps
- Impact metrics

**Answer**: Yes, included in Stage 2 queries (parallel fetches for materials, journey, environment, eco claims).

### 10.5 Similar Products / Carousel

**Status**: Deferred - table not yet created.

The carousel will display **external products** (not internal passports). Need to create a table like:

```sql
CREATE TABLE brand_carousel_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  title text NOT NULL,
  image_url text NOT NULL,
  price numeric(10, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  webshop_url text NOT NULL,s
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

This table will be managed separately in the theme content editor.

---

## Appendix A: File Changes Summary

### Database Layer (`packages/db`)

| File | Change Type | Description |
|------|-------------|-------------|
| `src/schema/products/product-variants.ts` | Modify | Change UPID uniqueness from per-brand to per-product |
| `src/queries/dpp-public.ts` | **Create** | New public query functions for DPP data fetching |
| `src/queries/index.ts` | Modify | Export new `dpp-public` queries |

### DPP App (`apps/dpp`)

| File | Change Type | Description |
|------|-------------|-------------|
| `src/app/[brandId]/[productUpid]/page.tsx` | **Create** | Product-level DPP page |
| `src/app/[brandId]/[productUpid]/[variantUpid]/page.tsx` | **Create** | Variant-level DPP page |
| `src/app/[brandId]/[productUpid]/not-found.tsx` | **Create** | 404 page for product-level |
| `src/app/[brandId]/[productUpid]/[variantUpid]/not-found.tsx` | **Create** | 404 page for variant-level |
| `src/middleware.ts` | **Create** | Rate limiting middleware |
| `src/utils/transform-dpp-data.ts` | **Create** | Transform DB result to DppData interface |
| `src/app/[brand]/[upid]/page.tsx` | **Delete** | Remove old single-segment route |

### Migrations (`apps/api/supabase/migrations`)

| File | Change Type | Description |
|------|-------------|-------------|
| `YYYYMMDD_dpp_upid_constraints.sql` | **Create** | Change variant UPID uniqueness |
| `YYYYMMDD_dpp_public_rls_policies.sql` | **Create** | Add `anon` read policies for all DPP-related tables |

### Main App (`apps/app`)

| File | Change Type | Description |
|------|-------------|-------------|
| Passports table component | Modify | Add "View DPP" link column (product-level URL) |
| Export functionality | Modify | Include variant-level URLs in bulk export |

### Total New Files: 8
### Total Modified Files: 5
### Total Deleted Files: 1

---

## Appendix B: Migration SQL

```sql
-- Migration: DPP Public Access & Simplified UPID Constraints
-- Run this in a transaction

BEGIN;

-- ============================================================================
-- 1. UPID Constraint Changes
-- ============================================================================

-- Drop old cross-brand variant UPID constraint
DROP INDEX IF EXISTS idx_unique_upid_per_brand;

-- Create new per-product variant UPID constraint (simpler!)
CREATE UNIQUE INDEX idx_product_variants_upid_per_product 
ON product_variants (product_id, upid) 
WHERE upid IS NOT NULL AND upid != '';

-- ============================================================================
-- 2. Public Read Policies for DPP Display
-- ============================================================================

-- Products: Public can read published products
CREATE POLICY "products_public_select" ON products
FOR SELECT TO anon
USING (status = 'published');

-- Product variants: Public can read variants of published products
CREATE POLICY "product_variants_public_select" ON product_variants
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM products 
    WHERE products.id = product_id 
    AND products.status = 'published'
  )
);

-- Product materials: Public can read materials of published products
CREATE POLICY "product_materials_public_select" ON product_materials
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM products 
    WHERE products.id = product_id 
    AND products.status = 'published'
  )
);

-- Product journey steps: Public can read journey of published products
CREATE POLICY "product_journey_steps_public_select" ON product_journey_steps
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM products 
    WHERE products.id = product_id 
    AND products.status = 'published'
  )
);

-- Product journey step facilities: Public can read facilities of published products
CREATE POLICY "product_journey_step_facilities_public_select" ON product_journey_step_facilities
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM product_journey_steps pjs
    INNER JOIN products p ON pjs.product_id = p.id
    WHERE pjs.id = journey_step_id
    AND p.status = 'published'
  )
);

-- Product environment: Public can read environment data of published products
CREATE POLICY "product_environment_public_select" ON product_environment
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM products 
    WHERE products.id = product_id 
    AND products.status = 'published'
  )
);

-- Product eco claims: Public can read eco claims of published products
CREATE POLICY "product_eco_claims_public_select" ON product_eco_claims
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM products 
    WHERE products.id = product_id 
    AND products.status = 'published'
  )
);

-- ============================================================================
-- 3. Brand Data Policies (for display names, theme, etc.)
-- ============================================================================

-- Brands: Public can read brands that have published products
CREATE POLICY "brands_public_select" ON brands
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM products 
    WHERE products.brand_id = brands.id 
    AND products.status = 'published'
  )
);

-- Brand theme: Always public (needed for styling)
CREATE POLICY "brand_theme_public_select" ON brand_theme
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM products 
    WHERE products.brand_id = brand_theme.brand_id 
    AND products.status = 'published'
  )
);

-- Brand colors: Public can read colors used in published products
CREATE POLICY "brand_colors_public_select" ON brand_colors
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM product_variants pv
    INNER JOIN products p ON pv.product_id = p.id
    WHERE pv.color_id = brand_colors.id
    AND p.status = 'published'
  )
);

-- Brand sizes: Public can read sizes used in published products
CREATE POLICY "brand_sizes_public_select" ON brand_sizes
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM product_variants pv
    INNER JOIN products p ON pv.product_id = p.id
    WHERE pv.size_id = brand_sizes.id
    AND p.status = 'published'
  )
);

-- Brand materials: Public can read materials used in published products
CREATE POLICY "brand_materials_public_select" ON brand_materials
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM product_materials pm
    INNER JOIN products p ON pm.product_id = p.id
    WHERE pm.brand_material_id = brand_materials.id
    AND p.status = 'published'
  )
);

-- Brand certifications: Public can read certifications of materials in published products
CREATE POLICY "brand_certifications_public_select" ON brand_certifications
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM brand_materials bm
    INNER JOIN product_materials pm ON pm.brand_material_id = bm.id
    INNER JOIN products p ON pm.product_id = p.id
    WHERE bm.certification_id = brand_certifications.id
    AND p.status = 'published'
  )
);

-- Brand facilities: Public can read facilities in journey of published products
CREATE POLICY "brand_facilities_public_select" ON brand_facilities
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM product_journey_step_facilities pjsf
    INNER JOIN product_journey_steps pjs ON pjsf.journey_step_id = pjs.id
    INNER JOIN products p ON pjs.product_id = p.id
    WHERE pjsf.facility_id = brand_facilities.id
    AND p.status = 'published'
  )
);

-- Brand eco claims: Public can read eco claims used in published products
CREATE POLICY "brand_eco_claims_public_select" ON brand_eco_claims
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM product_eco_claims pec
    INNER JOIN products p ON pec.product_id = p.id
    WHERE pec.eco_claim_id = brand_eco_claims.id
    AND p.status = 'published'
  )
);

-- Showcase brands (manufacturers): Public can read for published products
CREATE POLICY "showcase_brands_public_select" ON showcase_brands
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM products 
    WHERE products.showcase_brand_id = showcase_brands.id 
    AND products.status = 'published'
  )
);

-- ============================================================================
-- 4. Global Reference Data
-- ============================================================================

-- Categories: Global read (not sensitive)
CREATE POLICY "categories_public_select" ON categories
FOR SELECT TO anon
USING (true);

COMMIT;
```

### Important Notes on RLS Policies

1. **Scoped Access**: All brand-specific data is only accessible when related to a **published product**. This prevents data leakage of unpublished or draft products.

2. **Performance Consideration**: The `EXISTS` subqueries in RLS policies are evaluated for each row. For high-traffic scenarios, consider:
   - Adding indexes on the foreign keys used in these checks
   - Using a materialized view for public data
   - Implementing application-level caching

3. **Service Role Bypass**: These policies only apply to the `anon` role. The service role (used by internal APIs) bypasses RLS entirely.

4. **Cascading Access**: The policies form a chain:
   ```
   Product (published) 
     → Variant 
     → Materials → Brand Materials → Certifications
     → Journey Steps → Facilities
     → Environment
     → Eco Claims → Brand Eco Claims
     → Theme
     → Showcase Brand (manufacturer)
   ```

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| Dec 2024 | 1.0 | Initial plan with hierarchical URL approach |

