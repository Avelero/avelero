# Research: Current State of Avelero Product & Variant Architecture

This document provides a comprehensive snapshot of how products, variants, and integrations work in the Avelero Digital Product Passport (DPP) platform. It is intended to give an LLM all necessary context to implement the variant-level data override architecture.

---

## Table of Contents

1. [Repository Structure Overview](#1-repository-structure-overview)
2. [Database Schema - Products](#2-database-schema---products)
3. [Database Schema - Integrations](#3-database-schema---integrations)  
4. [Integration Sync Logic](#4-integration-sync-logic)
5. [API Layer (tRPC Routers)](#5-api-layer-trpc-routers)
6. [Frontend - Product/Passport UI](#6-frontend---productpassport-ui)
7. [DPP Rendering](#7-dpp-rendering)
8. [Key Files Reference](#8-key-files-reference)

---

## 1. Repository Structure Overview

The Avelero monorepo is organized as follows:

```
avelero-v2/
├── apps/
│   ├── api/            # Hono API server with tRPC
│   ├── app/            # Next.js admin dashboard
│   ├── dpp/            # Next.js public DPP viewer
│   └── web/            # Marketing website
├── packages/
│   ├── db/             # Drizzle ORM schema, queries, migrations
│   ├── integrations/   # Shopify and other integration connectors
│   ├── jobs/           # Trigger.dev background jobs
│   ├── dpp-components/ # Shared React components for DPP rendering
│   └── ui/             # Shared UI component library
└── supabase/           # Supabase config and migrations
```

### Key Package Responsibilities

| Package | Purpose |
|---------|---------|
| `@v1/db` | Drizzle ORM schema definitions, database queries, migrations |
| `@v1/integrations` | Integration connectors (Shopify), sync engine, field mapping |
| `@v1/jobs` | Trigger.dev background job definitions (sync jobs) |
| `apps/api` | REST/tRPC API layer, routers, schemas |
| `apps/app` | Admin dashboard (product forms, tables, settings) |
| `apps/dpp` | Public-facing Digital Product Passport viewer |

---

## 2. Database Schema - Products

### 2.1 Core Tables

#### `products` Table
**File:** `packages/db/src/schema/products/products.ts`

The main product entity table. Currently stores product-level data that should be the "canonical" user version.

```typescript
export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  brandId: uuid("brand_id").references(() => brands.id).notNull(),
  name: text("name").notNull(),
  productHandle: text("product_handle").notNull(),
  description: text("description"),
  manufacturerId: uuid("manufacturer_id").references(() => brandManufacturers.id),
  imagePath: text("image_path"),
  categoryId: uuid("category_id").references(() => taxonomyCategories.id),
  seasonId: uuid("season_id").references(() => brandSeasons.id),
  status: text("status").notNull().default("unpublished"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});
```

**Key Points:**
- `name`, `description`, `imagePath` are stored at product level
- `categoryId`, `seasonId`, `manufacturerId` are product-level relations
- `productHandle` is the URL-friendly identifier (unique per brand)
- `status` controls DPP visibility ("published", "unpublished", etc.)

#### `product_variants` Table
**File:** `packages/db/src/schema/products/product-variants.ts`

Variant entity with identification fields.

```typescript
export const productVariants = pgTable("product_variants", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  barcode: text("barcode"),
  sku: text("sku"),
  upid: text("upid"), // 16-char unique passport identifier
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});
```

**Key Points:**
- Variants are the primary matching key for integration sync (via barcode/SKU)
- `upid` is the unique identifier used in DPP URLs
- Currently NO variant-level fields for name, description, image (inherited from product)

### 2.2 Product Data Tables

#### `product_commercial` Table
**File:** `packages/db/src/schema/products/product-commercial.ts`

Commercial/pricing data at product level.

```typescript
export const productCommercial = pgTable("product_commercial", {
  productId: uuid("product_id").primaryKey().references(() => products.id),
  webshopUrl: text("webshop_url"),
  price: numeric("price", { precision: 10, scale: 2 }),
  currency: text("currency"),
  salesStatus: text("sales_status"),
  createdAt, updatedAt
});
```

#### `product_environment` Table
**File:** `packages/db/src/schema/products/product-environment.ts`

Environmental metrics stored per metric type.

```typescript
export const productEnvironment = pgTable("product_environment", {
  productId: uuid("product_id").references(() => products.id).notNull(),
  value: numeric("value"),
  unit: text("unit"),
  metric: text("metric").notNull(), // 'carbon_kg_co2e', 'water_liters'
  // Composite PK: (productId, metric)
});
```

#### `product_materials` Table
**File:** `packages/db/src/schema/products/product-materials.ts`

Material composition at product level.

```typescript
export const productMaterials = pgTable("product_materials", {
  id: uuid("id").primaryKey(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  brandMaterialId: uuid("brand_material_id").references(() => brandMaterials.id).notNull(),
  percentage: numeric("percentage"),
});
```

#### `product_journey_steps` Table
**File:** `packages/db/src/schema/products/product-journey-steps.ts`

Supply chain journey at product level.

```typescript
export const productJourneySteps = pgTable("product_journey_steps", {
  id: uuid("id").primaryKey(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  sortIndex: integer("sort_index").notNull(),
  stepType: text("step_type").notNull(),
  facilityId: uuid("facility_id").references(() => brandFacilities.id).notNull(),
});
```

#### `product_eco_claims` Table
**File:** `packages/db/src/schema/products/product-eco-claims.ts`

Eco claims linked to products.

```typescript
export const productEcoClaims = pgTable("product_eco_claims", {
  id: uuid("id").primaryKey(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  ecoClaimId: uuid("eco_claim_id").references(() => brandEcoClaims.id).notNull(),
});
```

#### `product_tags` Table
**File:** `packages/db/src/schema/products/product-tags.ts`

Tags assigned to products.

```typescript
export const productTags = pgTable("product_tags", {
  id: uuid("id").primaryKey(),
  tagId: uuid("tag_id").references(() => brandTags.id).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
});
```

#### `product_variant_attributes` Table
**File:** `packages/db/src/schema/products/product-variant-attributes.ts`

Attributes (Color, Size, etc.) assigned to variants.

```typescript
export const productVariantAttributes = pgTable("product_variant_attributes", {
  variantId: uuid("variant_id").references(() => productVariants.id).notNull(),
  attributeValueId: uuid("attribute_value_id").references(() => brandAttributeValues.id).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  // Composite PK: (variantId, attributeValueId)
});
```

### 2.3 Schema Index File

**File:** `packages/db/src/schema/index.ts`

Exports all schema tables. When adding new variant-level tables, they must be added here.

---

## 3. Database Schema - Integrations

### 3.1 Integration Link Tables

#### `integration_product_links` Table
**File:** `packages/db/src/schema/integrations/links/product-links.ts`

Maps external product IDs to Avelero products.

```typescript
export const integrationProductLinks = pgTable("integration_product_links", {
  id: uuid("id").primaryKey(),
  brandIntegrationId: uuid("brand_integration_id").references(() => brandIntegrations.id).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  externalId: text("external_id").notNull(),
  externalName: text("external_name"),
  lastSyncedAt: timestamp("last_synced_at"),
  lastSyncedHash: text("last_synced_hash"), // For change detection
});
```

**Key Points:**
- One external product ID per integration per Avelero product
- `lastSyncedHash` used to skip unchanged products during sync
- **PROBLEM:** Multiple Shopify products can map to one Avelero product, causing conflicts

#### `integration_variant_links` Table
**File:** `packages/db/src/schema/integrations/links/variant-links.ts`

Maps external variant IDs to Avelero variants.

```typescript
export const integrationVariantLinks = pgTable("integration_variant_links", {
  id: uuid("id").primaryKey(),
  brandIntegrationId: uuid("brand_integration_id").references(() => brandIntegrations.id).notNull(),
  variantId: uuid("variant_id").references(() => productVariants.id).notNull(),
  externalId: text("external_id").notNull(),
  externalProductId: text("external_product_id"),
  externalSku: text("external_sku"),
  externalBarcode: text("external_barcode"),
  lastSyncedAt: timestamp("last_synced_at"),
  lastSyncedHash: text("last_synced_hash"),
});
```

**Key Points:**
- Variants are matched by barcode/SKU during sync
- `externalProductId` tracks which Shopify product this variant came from
- **This is the key table for the solution** - variant links contain source tracking

#### Entity Link Tables
**File:** `packages/db/src/schema/integrations/links/entity-links.ts`

Links for catalog entities (materials, facilities, seasons, tags, etc.).

---

## 4. Integration Sync Logic

### 4.1 Sync Engine Architecture

**File:** `packages/integrations/src/sync/engine.ts`

The sync engine processes products from external systems in batches.

```typescript
export async function syncProducts(ctx: SyncContext): Promise<SyncResult> {
  // 1. Fetch products from connector in batches
  // 2. Pre-fetch all lookup data (links, identifier matches)
  // 3. Process each product to compute pending operations
  // 4. Execute all DB operations in batch
}
```

**Key Flow:**
1. **Fetch** - Get products from Shopify in batches
2. **Pre-fetch** - Batch lookup of existing links and identifier matches
3. **Process** - Compute what needs to be created/updated
4. **Execute** - Batch insert/update operations

### 4.2 Processor Logic

**File:** `packages/integrations/src/sync/processor.ts`

Processes individual products without DB queries (synchronous).

```typescript
export function processProduct(
  ctx: SyncContext,
  externalProduct: FetchedProduct,
  mappings: EffectiveFieldMapping[],
  caches: SyncCaches,
  preFetched: PreFetchedData,
  usedHandlesInBatch: Set<string>
): ProcessedProductResult
```

**Current Behavior:**
1. Check for existing product link
2. If no link, try to match by variant identifiers (barcode/SKU)
3. If no match, create new product
4. Process variants (update existing or create new)
5. **All product-level data is written to product tables**

### 4.3 Field Extraction

**File:** `packages/integrations/src/types.ts`

Extracted values structure:

```typescript
export interface ExtractedValues {
  product: ExtractedProductValues;  // name, description, imagePath, etc.
  variant: ExtractedVariantValues;  // sku, barcode
  referenceEntities: ExtractedReferenceEntities; // categoryId
  relations: ExtractedRelations; // tags
}
```

**Current Problem:** All commercial data goes to product-level tables, not variant-level.

### 4.4 Batch Operations

**File:** `packages/db/src/queries/integrations/sync-batch-operations.ts`

Batch database operations for sync efficiency:

- `batchUpdateProducts()` - Update product table fields
- `batchUpsertProductCommercial()` - Upsert commercial data
- `batchUpdateVariants()` - Update variant SKU/barcode only
- `batchSetProductTags()` - Replace product tags
- `batchUpsertProductLinks()` / `batchUpsertVariantLinks()` - Link management

---

## 5. API Layer (tRPC Routers)

### 5.1 Products Router

**File:** `apps/api/src/trpc/routers/products/index.ts`

Main product CRUD operations:

```typescript
export const productsRouter = createTRPCRouter({
  list: ...,  // List products with pagination and filters
  get: ...,   // Get single product by ID or handle
  create: ..., // Create new product
  update: ..., // Update product (single or bulk)
  delete: ..., // Delete product (single or bulk)
  variants: productVariantsRouter, // Nested router
});
```

**Key Functions:**
- `getProductWithIncludes()` - Fetches product with variants and attributes
- `listProductsWithIncludes()` - Lists products for table display
- `applyProductAttributes()` - Applies materials, eco claims, journey, tags

### 5.2 Variants Router

**File:** `apps/api/src/trpc/routers/products/variants.ts`

Variant-specific operations (update SKU/barcode, replace variants).

### 5.3 Product Query Types

**File:** `packages/db/src/queries/products/types.ts`

```typescript
export interface ProductRecord {
  id: string;
  name?: string | null;
  description?: string | null;
  category_id?: string | null;
  season_id?: string | null;
  // ... all product-level fields
}

export interface ProductVariantWithAttributes extends ProductVariantSummary {
  attributes: VariantAttributeSummary[];
}

export interface ProductWithRelations extends ProductRecord {
  variants?: ProductVariantWithAttributes[];
  attributes?: ProductAttributesBundle;
}
```

---

## 6. Frontend - Product/Passport UI

### 6.1 Product Table (List View)

**File:** `apps/app/src/components/tables/passports/columns.tsx`

Table columns for product listing:
- Product (image + name + handle)
- Status
- Category
- Season
- Variants (count)
- Tags
- Actions

**File:** `apps/app/src/components/tables/passports/types.ts`

```typescript
export interface PassportTableRow extends ProductPassportRow {
  passportIds: string[];
  variantCount: number;
  tags: Array<{ id: string; name: string | null; hex: string | null }>;
}
```

### 6.2 Product Form (Create/Edit)

**File:** `apps/app/src/components/forms/passport/create-passport-form.tsx`

Main form component with sections:
- `BasicInfoSection` - Name, description, image
- `OrganizationSection` - Category, season, tags
- `VariantSection` - Variant dimensions and metadata
- `EnvironmentSection` - Carbon, water, eco claims
- `MaterialsSection` - Material composition
- `JourneySection` - Supply chain steps

### 6.3 Variant Block

**File:** `apps/app/src/components/forms/passport/blocks/variant-block/index.tsx`

Manages variant dimensions (Color, Size, etc.) and generates cartesian product of variants.

**Key Types:**

```typescript
export interface VariantDimension {
  id: string;
  attributeId: string | null;
  attributeName: string;
  taxonomyAttributeId: string | null;
  values: string[];
  isCustomInline?: boolean;
  customAttributeName?: string;
  customValues?: string[];
}

export interface ExplicitVariant {
  id: string;
  sku: string;
  barcode: string;
  attributeValueIds: string[];
}
```

### 6.4 Route Structure

```
apps/app/src/app/(dashboard)/(main)/(sidebar)/passports/
├── (form)/
│   ├── create/page.tsx   # Create passport page
│   └── edit/[handle]/    # Edit passport page (by product handle)
└── (list)/
    └── page.tsx          # Passport list/table page
```

---

## 7. DPP Rendering

### 7.1 DPP Public Query

**File:** `packages/db/src/queries/dpp/public.ts`

Fetches all data needed for public DPP rendering.

```typescript
export async function getDppByProductHandle(
  db: Database,
  brandSlug: string,
  productHandle: string,
): Promise<DppPublicData | null>

export async function getDppByVariantUpid(
  db: Database,
  brandSlug: string,
  productHandle: string,
  variantUpid: string,
): Promise<DppPublicData | null>
```

**DppPublicData Structure:**

```typescript
export interface DppPublicData {
  sourceType: "product" | "variant";
  
  // Product core data (always present)
  productId: string;
  productName: string;
  productDescription: string | null;
  productImage: string | null;
  productHandle: string;
  productStatus: string;
  
  // Variant data (null if product-level)
  variantId: string | null;
  variantUpid: string | null;
  variantAttributes: DppVariantAttribute[];
  variantSku, variantGtin, variantEan, variantBarcode: string | null;
  
  // Brand, category, manufacturer
  brandId, brandName: string;
  categoryId, categoryName: string | null;
  manufacturerName, manufacturerCountryCode: string | null;
  
  // Product attributes (materials, journey, environment, eco claims)
  materials: DppMaterial[];
  journey: DppJourneyStep[];
  environment: DppEnvironment | null;
  ecoClaims: string[];
  
  // Theme
  themeConfig, themeStyles, stylesheetPath, googleFontsUrl: ...;
}
```

**Current Behavior:**
- Product-level DPP: Shows product name, description, image
- Variant-level DPP: Shows product name, description, image + variant attributes (Color, Size)
- **All variants of a product show the same name/description/image**

### 7.2 URL Structure

```
/:brandSlug/:productHandle/              # Product-level DPP
/:brandSlug/:productHandle/:variantUpid  # Variant-level DPP
```

---

## 8. Key Files Reference

### Schema Files

| File | Purpose |
|------|---------|
| `packages/db/src/schema/products/products.ts` | Main products table |
| `packages/db/src/schema/products/product-variants.ts` | Variants table |
| `packages/db/src/schema/products/product-commercial.ts` | Commercial data |
| `packages/db/src/schema/products/product-environment.ts` | Environmental metrics |
| `packages/db/src/schema/products/product-materials.ts` | Material composition |
| `packages/db/src/schema/products/product-journey-steps.ts` | Journey steps |
| `packages/db/src/schema/products/product-eco-claims.ts` | Eco claims |
| `packages/db/src/schema/products/product-tags.ts` | Product tags |
| `packages/db/src/schema/products/product-variant-attributes.ts` | Variant attributes |
| `packages/db/src/schema/integrations/links/product-links.ts` | Integration product links |
| `packages/db/src/schema/integrations/links/variant-links.ts` | Integration variant links |
| `packages/db/src/schema/index.ts` | Schema exports |

### Integration Files

| File | Purpose |
|------|---------|
| `packages/integrations/src/sync/engine.ts` | Main sync orchestration |
| `packages/integrations/src/sync/processor.ts` | Product/variant processing |
| `packages/integrations/src/sync/batch-operations.ts` | Entity extraction |
| `packages/integrations/src/types.ts` | Type definitions |
| `packages/db/src/queries/integrations/sync-batch-operations.ts` | Batch DB operations |

### Query Files

| File | Purpose |
|------|---------|
| `packages/db/src/queries/products/list.ts` | Product listing |
| `packages/db/src/queries/products/get.ts` | Single product fetch |
| `packages/db/src/queries/products/crud.ts` | Create/update/delete |
| `packages/db/src/queries/products/types.ts` | Query type definitions |
| `packages/db/src/queries/dpp/public.ts` | Public DPP data fetch |

### API Files

| File | Purpose |
|------|---------|
| `apps/api/src/trpc/routers/products/index.ts` | Products router |
| `apps/api/src/trpc/routers/products/variants.ts` | Variants router |
| `apps/api/src/schemas/products.ts` | Zod schemas |

### Frontend Files

| File | Purpose |
|------|---------|
| `apps/app/src/components/forms/passport/create-passport-form.tsx` | Main form |
| `apps/app/src/components/forms/passport/blocks/variant-block/index.tsx` | Variant section |
| `apps/app/src/components/tables/passports/columns.tsx` | Table columns |
| `apps/app/src/components/tables/passports/data-table.tsx` | Table component |
| `apps/app/src/components/tables/passports/types.ts` | Table types |

---

## Summary: Current Architecture Issues

### The Problem

When multiple external systems integrate with Avelero:

1. **Product grouping differs between systems**
   - ERP: "Amazing Jacket" with all color/size variants
   - Shopify: "Amazing Jacket Black", "Amazing Jacket White" as separate products

2. **Current sync writes to product level**
   - Name, description, image go to `products` table
   - Multiple Shopify products mapping to one Avelero product = conflict

3. **No variant-level data storage**
   - Variants only store: barcode, sku, upid, attributes
   - No way to store variant-specific name, description, image

4. **DPP renders product-level data**
   - All variants show the same name/description/image
   - Cannot show "Amazing Jacket Black" for black variants

### What Needs to Change

1. **New variant-level override tables** (variants_commercial, variants_environment, etc.)
2. **Sync logic to write to variant tables** instead of/in addition to product tables
3. **DPP resolution function** that checks variant overrides first
4. **UI for editing variant-level data** when overrides exist
5. **Product table indicators** showing which products have variant overrides
