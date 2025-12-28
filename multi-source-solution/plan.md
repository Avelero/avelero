# Implementation Plan: Variant-Level Data Override Architecture

This document provides a comprehensive implementation plan for adding variant-level override tables to solve multi-source integration conflicts.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Solution Overview](#2-solution-overview)
3. [Scope Definition](#3-scope-definition)
4. [Phase 1: Database Schema](#phase-1-database-schema)
5. [Phase 2: Data Resolution Layer](#phase-2-data-resolution-layer)
6. [Phase 3: Sync Logic Updates](#phase-3-sync-logic-updates)
7. [Phase 4: API Layer Updates](#phase-4-api-layer-updates)
8. [Phase 5: Variant Edit Page](#phase-5-variant-edit-page)
9. [Phase 6: DPP Rendering Updates](#phase-6-dpp-rendering-updates)
10. [File Change Summary](#file-change-summary)

---

## 1. Problem Statement

When multiple external systems integrate with Avelero, product groupings differ:

```
Shopify                              Avelero (from ERP)
┌──────────────────────┐             ┌──────────────────────────┐
│ "Amazing Jacket      │             │ Product: "Amazing Jacket"│
│  Black"              │─────┐       │                          │
│ variants 1,2,3       │     │       │ Variants: 1,2,3,4,5,6,7  │
│ image: black.jpg     │     ├──────▶│                          │
│ materials: 100% wool │     │       │ CONFLICT: Which source's │
└──────────────────────┘     │       │ data do we use for each  │
┌──────────────────────┐     │       │ variant?                 │
│ "Amazing Jacket      │     │       │                          │
│  White"              │─────┘       └──────────────────────────┘
│ variants 4,5,6,7     │
│ image: white.jpg     │
│ materials: 80% cotton│
└──────────────────────┘
```

---

## 2. Solution Overview

### Variant-Level Overrides for ALL Data Types

Store integration data at variant level. Product-level remains the user's "canonical" version.

```
PRODUCT LEVEL (User's canonical data)
├── products: name, description, imagePath
├── product_commercial: webshopUrl, price, currency
├── product_environment: carbon, water
├── product_eco_claims: linked claims
├── product_materials: composition
├── product_weight: weight data
└── product_journey_steps: supply chain
                │
                │ INHERIT (if variant value is null)
                ▼
VARIANT LEVEL (Integration overrides)
├── product_variants: name, description, imagePath (NEW columns)
├── variant_commercial: webshopUrl, price, currency
├── variant_environment: carbon, water
├── variant_eco_claims: linked claims
├── variant_materials: composition
├── variant_weight: weight data
└── variant_journey_steps: supply chain
                │
                │ RESOLVE: variant_value ?? product_value
                ▼
DPP RENDERING
```

---

## 3. Scope Definition

### Fields That CAN Be Overridden Per Variant

| Data Category | Product Table | Variant Table | Fields |
|---------------|---------------|---------------|--------|
| **Core Display** | `products` | `product_variants` (extended) | name, description, imagePath |
| **Commercial** | `product_commercial` | `variant_commercial` (NEW) | webshopUrl, price, currency, salesStatus |
| **Environment** | `product_environment` | `variant_environment` (NEW) | carbonKgCo2e, waterLiters |
| **Eco Claims** | `product_eco_claims` | `variant_eco_claims` (NEW) | ecoClaimId references |
| **Materials** | `product_materials` | `variant_materials` (NEW) | brandMaterialId, percentage |
| **Weight** | `product_weight` | `variant_weight` (NEW) | weight, weightUnit |
| **Journey** | `product_journey_steps` | `variant_journey_steps` (NEW) | sortIndex, stepType, facilityId |

### Fields That STAY Product-Only (No Variant Override)

| Field | Reason |
|-------|--------|
| `categoryId` | Product categorization doesn't vary per variant |
| `seasonId` | Season is product-level concept |
| `tags` | Organization doesn't vary per variant |
| `manufacturerId` | Manufacturer is product-level |
| `productHandle` | URL identifier must be unique |
| `status` | Publishing status is product-level |

---

## Phase 1: Database Schema

### 1.1 Extend `product_variants` Table

**File to EDIT:** `packages/db/src/schema/products/product-variants.ts`

Add columns for core display overrides:

```typescript
export const productVariants = pgTable("product_variants", {
  // Existing columns
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  barcode: text("barcode"),
  sku: text("sku"),
  upid: text("upid"),
  
  // NEW: Display override columns (nullable = inherit from product)
  name: text("name"),
  description: text("description"),
  imagePath: text("image_path"),
  
  // NEW: Source tracking
  sourceIntegration: text("source_integration"),
  sourceExternalId: text("source_external_id"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### 1.2 New Table: `variant_commercial`

**File to CREATE:** `packages/db/src/schema/products/variant-commercial.ts`

```typescript
export const variantCommercial = pgTable("variant_commercial", {
  variantId: uuid("variant_id")
    .references(() => productVariants.id, { onDelete: "cascade" })
    .primaryKey().notNull(),
  
  webshopUrl: text("webshop_url"),
  price: numeric("price", { precision: 10, scale: 2 }),
  currency: text("currency"),
  salesStatus: text("sales_status"),
  
  sourceIntegration: text("source_integration"),
  sourceExternalId: text("source_external_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### 1.3 New Table: `variant_environment`

**File to CREATE:** `packages/db/src/schema/products/variant-environment.ts`

```typescript
export const variantEnvironment = pgTable("variant_environment", {
  variantId: uuid("variant_id")
    .references(() => productVariants.id, { onDelete: "cascade" })
    .primaryKey().notNull(),
  
  carbonKgCo2e: numeric("carbon_kg_co2e", { precision: 10, scale: 4 }),
  waterLiters: numeric("water_liters", { precision: 10, scale: 2 }),
  
  sourceIntegration: text("source_integration"),
  sourceExternalId: text("source_external_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### 1.4 New Table: `variant_eco_claims`

**File to CREATE:** `packages/db/src/schema/products/variant-eco-claims.ts`

```typescript
export const variantEcoClaims = pgTable("variant_eco_claims", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  variantId: uuid("variant_id")
    .references(() => productVariants.id, { onDelete: "cascade" }).notNull(),
  ecoClaimId: uuid("eco_claim_id")
    .references(() => brandEcoClaims.id, { onDelete: "cascade" }).notNull(),
  
  sourceIntegration: text("source_integration"),
  sourceExternalId: text("source_external_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### 1.5 New Table: `variant_materials`

**File to CREATE:** `packages/db/src/schema/products/variant-materials.ts`

```typescript
export const variantMaterials = pgTable("variant_materials", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  variantId: uuid("variant_id")
    .references(() => productVariants.id, { onDelete: "cascade" }).notNull(),
  brandMaterialId: uuid("brand_material_id")
    .references(() => brandMaterials.id, { onDelete: "cascade" }).notNull(),
  percentage: numeric("percentage", { precision: 5, scale: 2 }),
  
  sourceIntegration: text("source_integration"),
  sourceExternalId: text("source_external_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### 1.6 New Table: `variant_weight`

**File to CREATE:** `packages/db/src/schema/products/variant-weight.ts`

```typescript
export const variantWeight = pgTable("variant_weight", {
  variantId: uuid("variant_id")
    .references(() => productVariants.id, { onDelete: "cascade" })
    .primaryKey().notNull(),
  
  weight: numeric("weight", { precision: 10, scale: 4 }),
  weightUnit: text("weight_unit"),
  
  sourceIntegration: text("source_integration"),
  sourceExternalId: text("source_external_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### 1.7 New Table: `variant_journey_steps`

**File to CREATE:** `packages/db/src/schema/products/variant-journey-steps.ts`

```typescript
export const variantJourneySteps = pgTable("variant_journey_steps", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  variantId: uuid("variant_id")
    .references(() => productVariants.id, { onDelete: "cascade" }).notNull(),
  
  sortIndex: integer("sort_index").notNull(),
  stepType: text("step_type").notNull(),
  facilityId: uuid("facility_id")
    .references(() => brandFacilities.id, { onDelete: "cascade" }).notNull(),
  
  sourceIntegration: text("source_integration"),
  sourceExternalId: text("source_external_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### 1.8 Update Schema Index

**File to EDIT:** `packages/db/src/schema/index.ts`

Add exports for all new tables:

```typescript
// Product schemas
export * from "./products/products";
export * from "./products/product-variants";
// ... existing exports ...

// NEW: Variant override tables
export * from "./products/variant-commercial";
export * from "./products/variant-environment";
export * from "./products/variant-eco-claims";
export * from "./products/variant-materials";
export * from "./products/variant-weight";
export * from "./products/variant-journey-steps";
```

---

## Phase 2: Data Resolution Layer

### 2.1 Create Resolution Module

**File to CREATE:** `packages/db/src/queries/products/resolve-variant-data.ts`

```typescript
/**
 * Resolves variant data by checking variant-level overrides first,
 * then falling back to product-level data.
 */

export interface ResolvedVariantData {
  // Identity
  variantId: string;
  variantUpid: string | null;
  productId: string;
  productHandle: string;
  brandId: string;
  
  // Core display (resolved)
  name: string;
  description: string | null;
  imagePath: string | null;
  
  // Commercial (resolved)
  commercial: ResolvedCommercial;
  
  // Environment (resolved)
  environment: ResolvedEnvironment | null;
  
  // Eco claims (variant-level if exists, else product-level)
  ecoClaims: ResolvedEcoClaim[];
  
  // Materials (variant-level if exists, else product-level)
  materials: ResolvedMaterial[];
  
  // Weight (resolved)
  weight: ResolvedWeight | null;
  
  // Journey (variant-level if exists, else product-level)
  journey: ResolvedJourneyStep[];
  
  // Metadata
  hasOverrides: boolean;
  overriddenSections: string[];
  sourceIntegration: string | null;
}

/**
 * Resolve all variant data with inheritance.
 * Looks up by UPID (public identifier), not UUID.
 */
export async function resolveVariantDataByUpid(
  db: Database,
  productHandle: string,
  variantUpid: string
): Promise<ResolvedVariantData | null> {
  // First find variant by UPID
  const [variant] = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(
      eq(products.productHandle, productHandle),
      eq(productVariants.upid, variantUpid)
    ))
    .limit(1);
  
  if (!variant) return null;
  
  return resolveVariantDataById(db, variant.id);
}

/**
 * Resolve variant data by internal UUID.
 */
export async function resolveVariantDataById(
  db: Database,
  variantId: string
): Promise<ResolvedVariantData | null> {
  // Fetch all data in parallel
  const [
    coreData,
    variantCommercialData,
    productCommercialData,
    variantEnvData,
    productEnvData,
    variantEcoClaimsData,
    productEcoClaimsData,
    variantMaterialsData,
    productMaterialsData,
    variantWeightData,
    productWeightData,
    variantJourneyData,
    productJourneyData,
  ] = await Promise.all([
    fetchCoreVariantData(db, variantId),
    fetchVariantCommercial(db, variantId),
    fetchProductCommercialByVariant(db, variantId),
    fetchVariantEnvironment(db, variantId),
    fetchProductEnvironmentByVariant(db, variantId),
    fetchVariantEcoClaims(db, variantId),
    fetchProductEcoClaimsByVariant(db, variantId),
    fetchVariantMaterials(db, variantId),
    fetchProductMaterialsByVariant(db, variantId),
    fetchVariantWeight(db, variantId),
    fetchProductWeightByVariant(db, variantId),
    fetchVariantJourney(db, variantId),
    fetchProductJourneyByVariant(db, variantId),
  ]);
  
  if (!coreData) return null;
  
  // Track which sections have overrides
  const overriddenSections: string[] = [];
  
  // Core display: variant columns ?? product columns
  const name = coreData.variantName ?? coreData.productName;
  const description = coreData.variantDescription ?? coreData.productDescription;
  const imagePath = coreData.variantImagePath ?? coreData.productImagePath;
  
  if (coreData.variantName || coreData.variantDescription || coreData.variantImagePath) {
    overriddenSections.push("basicInfo");
  }
  
  // Eco claims: use variant-level if ANY exist, else product-level
  const ecoClaims = variantEcoClaimsData.length > 0 
    ? variantEcoClaimsData 
    : productEcoClaimsData;
  if (variantEcoClaimsData.length > 0) overriddenSections.push("ecoClaims");
  
  // Materials: use variant-level if ANY exist, else product-level
  const materials = variantMaterialsData.length > 0 
    ? variantMaterialsData 
    : productMaterialsData;
  if (variantMaterialsData.length > 0) overriddenSections.push("materials");
  
  // Journey: use variant-level if ANY exist, else product-level
  const journey = variantJourneyData.length > 0 
    ? variantJourneyData 
    : productJourneyData;
  if (variantJourneyData.length > 0) overriddenSections.push("journey");
  
  // Similar resolution for commercial, environment, weight...
  
  return {
    variantId,
    variantUpid: coreData.variantUpid,
    productId: coreData.productId,
    productHandle: coreData.productHandle,
    brandId: coreData.brandId,
    name,
    description,
    imagePath,
    commercial: resolvedCommercial,
    environment: resolvedEnvironment,
    ecoClaims,
    materials,
    weight: resolvedWeight,
    journey,
    hasOverrides: overriddenSections.length > 0,
    overriddenSections,
    sourceIntegration: coreData.variantSourceIntegration,
  };
}

/**
 * Clear all overrides for a variant (all tables).
 */
export async function clearAllVariantOverrides(
  db: Database,
  variantId: string
): Promise<void> {
  await Promise.all([
    // Clear columns on product_variants
    db.update(productVariants)
      .set({ name: null, description: null, imagePath: null, sourceIntegration: null, sourceExternalId: null })
      .where(eq(productVariants.id, variantId)),
    // Delete from variant tables
    db.delete(variantCommercial).where(eq(variantCommercial.variantId, variantId)),
    db.delete(variantEnvironment).where(eq(variantEnvironment.variantId, variantId)),
    db.delete(variantEcoClaims).where(eq(variantEcoClaims.variantId, variantId)),
    db.delete(variantMaterials).where(eq(variantMaterials.variantId, variantId)),
    db.delete(variantWeight).where(eq(variantWeight.variantId, variantId)),
    db.delete(variantJourneySteps).where(eq(variantJourneySteps.variantId, variantId)),
  ]);
}
```

---

## Phase 3: Sync Logic Updates

### 3.1 Update Batch Operations

**File to EDIT:** `packages/db/src/queries/integrations/sync-batch-operations.ts`

Add batch upsert functions for each variant table:

```typescript
// NEW TYPES
export interface VariantCommercialUpsertData { ... }
export interface VariantEnvironmentUpsertData { ... }
export interface VariantMaterialsUpsertData { ... }
export interface VariantWeightUpsertData { ... }
export interface VariantJourneyUpsertData { ... }
export interface VariantEcoClaimsUpsertData { ... }

// NEW FUNCTIONS
export async function batchUpsertVariantCommercial(...) { ... }
export async function batchUpsertVariantEnvironment(...) { ... }
export async function batchReplaceVariantMaterials(...) { ... }
export async function batchUpsertVariantWeight(...) { ... }
export async function batchReplaceVariantJourney(...) { ... }
export async function batchReplaceVariantEcoClaims(...) { ... }

// UPDATE existing batchUpdateVariants to include name, description, imagePath
export async function batchUpdateVariants(
  db: Database,
  updates: VariantUpdateData[]
): Promise<number> {
  // Now includes name, description, imagePath, sourceIntegration, sourceExternalId
}
```

### 3.2 Update Processor

**File to EDIT:** `packages/integrations/src/sync/processor.ts`

Update `PendingOperations` and processing logic:

```typescript
export interface PendingOperations {
  // Existing...
  variantUpdates: Array<{
    id: string;
    sku?: string | null;
    barcode?: string | null;
    // NEW fields
    name?: string | null;
    description?: string | null;
    imagePath?: string | null;
    sourceIntegration?: string;
    sourceExternalId?: string;
  }>;
  
  // NEW operations
  variantCommercialUpserts: Array<VariantCommercialUpsertData>;
  variantEnvironmentUpserts: Array<VariantEnvironmentUpsertData>;
  variantMaterialsReplacements: Array<{ variantId: string; materials: MaterialData[]; source: string }>;
  variantWeightUpserts: Array<VariantWeightUpsertData>;
  variantJourneyReplacements: Array<{ variantId: string; steps: JourneyStepData[]; source: string }>;
  variantEcoClaimsReplacements: Array<{ variantId: string; claimIds: string[]; source: string }>;
}
```

### 3.3 Update Engine

**File to EDIT:** `packages/integrations/src/sync/engine.ts`

Execute all variant-level batch operations after variant creates.

---

## Phase 4: API Layer Updates

### 4.1 Create Variant Override Router

**File to CREATE:** `apps/api/src/trpc/routers/products/variant-overrides.ts`

```typescript
export const variantOverridesRouter = createTRPCRouter({
  /**
   * Get fully resolved variant data with source tracking.
   * Looks up by UPID (public identifier).
   */
  get: brandRequiredProcedure
    .input(z.object({ 
      productHandle: z.string(),
      variantUpid: z.string() 
    }))
    .query(async ({ ctx, input }) => {
      return resolveVariantDataByUpid(ctx.db, input.productHandle, input.variantUpid);
    }),

  /**
   * Update variant core display (name, description, image).
   */
  updateCore: brandRequiredProcedure
    .input(z.object({
      productHandle: z.string(),
      variantUpid: z.string(),
      name: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      imagePath: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => { ... }),

  /**
   * Update variant commercial data.
   */
  updateCommercial: brandRequiredProcedure
    .input(z.object({
      productHandle: z.string(),
      variantUpid: z.string(),
      webshopUrl: z.string().url().nullable().optional(),
      price: z.string().nullable().optional(),
      currency: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => { ... }),

  /**
   * Update variant environment data.
   */
  updateEnvironment: brandRequiredProcedure
    .input(z.object({
      productHandle: z.string(),
      variantUpid: z.string(),
      carbonKgCo2e: z.string().nullable().optional(),
      waterLiters: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => { ... }),

  /**
   * Replace variant materials (set empty array to clear).
   */
  setMaterials: brandRequiredProcedure
    .input(z.object({
      productHandle: z.string(),
      variantUpid: z.string(),
      materials: z.array(z.object({
        brandMaterialId: z.string().uuid(),
        percentage: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => { ... }),

  /**
   * Replace variant journey steps.
   */
  setJourney: brandRequiredProcedure
    .input(z.object({
      productHandle: z.string(),
      variantUpid: z.string(),
      steps: z.array(z.object({
        sortIndex: z.number(),
        stepType: z.string(),
        facilityId: z.string().uuid(),
      })),
    }))
    .mutation(async ({ ctx, input }) => { ... }),

  /**
   * Replace variant eco claims.
   */
  setEcoClaims: brandRequiredProcedure
    .input(z.object({
      productHandle: z.string(),
      variantUpid: z.string(),
      ecoClaimIds: z.array(z.string().uuid()),
    }))
    .mutation(async ({ ctx, input }) => { ... }),

  /**
   * Update variant weight.
   */
  updateWeight: brandRequiredProcedure
    .input(z.object({
      productHandle: z.string(),
      variantUpid: z.string(),
      weight: z.string().nullable().optional(),
      weightUnit: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => { ... }),

  /**
   * Clear ALL overrides for a variant.
   */
  clearAll: brandRequiredProcedure
    .input(z.object({ 
      productHandle: z.string(),
      variantUpid: z.string() 
    }))
    .mutation(async ({ ctx, input }) => {
      const variantId = await findVariantIdByUpid(ctx.db, input.productHandle, input.variantUpid);
      await clearAllVariantOverrides(ctx.db, variantId);
      return { success: true };
    }),
});
```

### 4.2 Update Products Router

**File to EDIT:** `apps/api/src/trpc/routers/products/index.ts`

```typescript
import { variantOverridesRouter } from "./variant-overrides";

export const productsRouter = createTRPCRouter({
  // ... existing routes ...
  variants: productVariantsRouter,
  variantOverrides: variantOverridesRouter,  // NEW
});
```

---

## Phase 5: Variant Edit Page

### 5.1 UI Layout Overview

The variant edit page uses a **flipped scaffold layout**:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Edit Passport > Edit Variant                    [Cancel] [Save]    │
├──────────────┬──────────────────────────────────────────────────────┤
│              │                                                      │
│  NARROW      │  WIDE CONTENT (600px)                               │
│  SIDEBAR     │                                                      │
│  (300px)     │  ┌─────────────────────────────────────────────────┐│
│              │  │ Disclaimer: Values entered here override the    ││
│  ┌─────────┐ │  │ product defaults for this specific variant.    ││
│  │Product  │ │  └─────────────────────────────────────────────────┘│
│  │Thumbnail│ │                                                      │
│  │+ Name   │ │  ┌─────────────────────────────────────────────────┐│
│  │6 variants│ │ │ Basic Info Block                                ││
│  └─────────┘ │  │ (name, description, image)                      ││
│              │  │ Shows product default as placeholder            ││
│  [Search]    │  └─────────────────────────────────────────────────┘│
│              │                                                      │
│  ○ Black/XS  │  ┌─────────────────────────────────────────────────┐│
│  ○ Black/S   │  │ Environment Block                               ││
│  ● Black/M ◄─┤  │ (carbon, water, eco claims)                     ││
│  ○ Black/L   │  └─────────────────────────────────────────────────┘│
│  ○ White/S   │                                                      │
│  ○ White/M   │  ┌─────────────────────────────────────────────────┐│
│              │  │ Materials Block                                  ││
│              │  └─────────────────────────────────────────────────┘│
│              │                                                      │
│              │  ┌─────────────────────────────────────────────────┐│
│              │  │ Journey Block                                    ││
│              │  └─────────────────────────────────────────────────┘│
│              │                                                      │
└──────────────┴──────────────────────────────────────────────────────┘
```

### 5.2 Key UI Details

| Aspect | Product Edit | Variant Edit |
|--------|--------------|--------------|
| Layout | Wide (600px) left, Narrow (300px) right | Narrow (300px) left, Wide (600px) right |
| Left sidebar content | Status, Identifiers | Variant overview/navigation |
| Blocks shown | All blocks | BasicInfo, Environment, Materials, Journey only |
| NOT shown | - | Organization, Variants blocks |
| Header | "Edit Passport" | "Edit Passport > Edit Variant" (custom breadcrumb) |
| Disclaimer | None | Top explanation about overrides |

### 5.3 URL Structure

Route uses **UPID** (public identifier), NOT UUID:

```
/passports/edit/[productHandle]/variant/[variantUpid]

Example:
/passports/edit/amazing-jacket/variant/AV3LR0X7K2M9P4Q1
```

**IMPORTANT:** The internal UUID is never exposed in URLs. UPID is the 16-character alphanumeric unique product identifier.

### 5.4 Create Route

**File to CREATE:** `apps/app/src/app/(dashboard)/(main)/(sidebar)/passports/(form)/edit/[handle]/variant/[upid]/page.tsx`

```tsx
import { Suspense } from "react";
import { VariantEditForm } from "@/components/forms/variant/variant-edit-form";
import { VariantFormSkeleton } from "@/components/forms/variant/variant-form-skeleton";

interface Props {
  params: Promise<{ handle: string; upid: string }>;
}

export default async function VariantEditPage({ params }: Props) {
  const { handle, upid } = await params;
  return (
    <Suspense fallback={<VariantFormSkeleton />}>
      <VariantEditForm productHandle={handle} variantUpid={upid} />
    </Suspense>
  );
}
```

**NOTE:** Use `VariantFormSkeleton` (NOT `PassportFormSkeleton`) because the layouts are different - variant edit has the narrow sidebar on the LEFT and wide content on the RIGHT.

### 5.5 Create Variant Edit Form

**File to CREATE:** `apps/app/src/components/forms/variant/variant-edit-form.tsx`

Key features:
- Uses `useVariantEditForm` hook (similar to `usePassportForm`)
- Flipped scaffold with variants sidebar on left
- **Separate form state** from product edit page
- Unsaved changes modal on navigation away (separate page = separate state)
- Disclaimer block at top of content area explaining override behavior
- **Imports and reuses existing block components** from `@/components/forms/passport/blocks/`:
  - `BasicInfoBlock` (name, description, image)
  - `EnvironmentBlock` (carbon, water, eco claims)
  - `MaterialsBlock` (material composition)
  - `JourneyBlock` (supply chain steps)
- Does NOT include `OrganizationBlock` or `VariantBlock` (those stay product-only)

**Breadcrumb Header** (inline in this component, not a separate file):

The breadcrumb is simple - just inline it where the header text goes:

```tsx
// Inside the variant-edit-form.tsx header area:
<nav className="flex items-center type-h6" aria-label="Breadcrumb">
  <Link
    href={`/passports/edit/${productHandle}`}
    className="text-secondary !font-medium hover:text-primary transition-colors duration-150"
  >
    Edit Passport
  </Link>
  <span className="mx-1.5 text-secondary !font-medium" aria-hidden="true">/</span>
  <span className="text-primary !font-medium">Edit Variant</span>
</nav>
```

No separate component needed - it's just a few lines of JSX.

### 5.6 Create Variants Overview Sidebar

**File to CREATE:** `apps/app/src/components/forms/variant/variants-overview.tsx`

Inspired by Shopify's variant selector:
- Product thumbnail + name + status badge at top
- Scrollable list of variants with attribute labels (e.g., "Black / S")
- Selected variant highlighted
- Click to navigate between variants using UPID in URL
- **NO search input** - not needed for our use case

### 5.7 Create Variant Form Skeleton

**File to CREATE:** `apps/app/src/components/forms/variant/variant-form-skeleton.tsx`

This is a loading skeleton specific to the variant edit layout:
- Narrow (300px) skeleton on LEFT (the variants overview sidebar)
- Wide (600px) skeleton on RIGHT (the content blocks)
- Different from `PassportFormSkeleton` which has the columns reversed

Can be defined inline in `variant-edit-form.tsx` or as a separate small component.

### 5.8 Create Variant Form Scaffold

**File to CREATE:** `apps/app/src/components/forms/variant/variant-form-scaffold.tsx`

Similar to `PassportFormScaffold` but:
- Narrow column on LEFT (sidebar prop)
- Wide column on RIGHT (content prop)
- Custom breadcrumb header instead of simple title

### 5.9 Unsaved Changes Handling

The variant edit page is a **separate page** with **separate form state**:
- Has its own `hasUnsavedChanges` tracking
- When navigating away (back to product edit, or other pages), show confirmation modal
- Use same modal pattern as existing unsaved changes handling in passport form

---

## Phase 6: DPP Rendering Updates

### 6.1 Update DPP Public Query

**File to EDIT:** `packages/db/src/queries/dpp/public.ts`

Use resolution layer for variant-level DPP:

```typescript
import { resolveVariantDataByUpid } from "../products/resolve-variant-data";

export async function getDppByVariantUpid(
  db: Database,
  brandSlug: string,
  productHandle: string,
  variantUpid: string,
): Promise<DppPublicData | null> {
  // Use resolution layer - handles all inheritance
  const resolved = await resolveVariantDataByUpid(db, productHandle, variantUpid);
  if (!resolved) return null;
  
  // Verify brand matches
  const brand = await getBrandBySlug(db, brandSlug);
  if (!brand || brand.id !== resolved.brandId) return null;
  
  return {
    sourceType: "variant",
    productName: resolved.name,
    productDescription: resolved.description,
    productImage: resolved.imagePath,
    materials: resolved.materials,
    journey: resolved.journey,
    environment: resolved.environment ? {
      carbonKgCo2e: resolved.environment.carbonKgCo2e,
      waterLiters: resolved.environment.waterLiters,
    } : null,
    ecoClaims: resolved.ecoClaims.map(c => c.claim),
    // ... rest of fields from resolved data
  };
}
```

---

## File Change Summary

### Files to CREATE (11 files)

| Category | Files |
|----------|-------|
| **Schema** | `variant-commercial.ts`, `variant-environment.ts`, `variant-eco-claims.ts`, `variant-materials.ts`, `variant-weight.ts`, `variant-journey-steps.ts` |
| **Queries** | `resolve-variant-data.ts` |
| **API** | `variant-overrides.ts` |
| **UI** | `variant-edit-form.tsx`, `variants-overview.tsx`, `variant-form-scaffold.tsx`, `variant-form-skeleton.tsx`, page route `[upid]/page.tsx` |

### Files to EDIT (10 files)

| Category | Files |
|----------|-------|
| **Schema** | `product-variants.ts` (add columns), `index.ts` (add exports) |
| **Queries** | `sync-batch-operations.ts`, `products/index.ts`, `dpp/public.ts` |
| **Sync** | `processor.ts`, `engine.ts` |
| **API** | `products/index.ts` |
| **UI** | `variant-table.tsx` (add click handler to navigate to variant edit) |

---

## Implementation Order

```
Phase 1: Database Schema (extend product_variants + 6 new tables)
    ↓
Phase 2: Data Resolution Layer
    ↓
Phase 3: Sync Logic Updates
    ↓
Phase 4: API Layer Updates
    ↓
Phase 5: Variant Edit Page (full UI)
    ↓
Phase 6: DPP Rendering Updates
```
