# Bulk Import Refactor Plan

> **Document Version:** 2.0  
> **Created:** 2026-01-09  
> **Last Updated:** 2026-01-09  
> **Status:** Planning Phase

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [New Excel Template Structure](#new-excel-template-structure)
3. [Row Grouping & Variant-Level Overrides](#row-grouping--variant-level-overrides)
4. [Import Mode: Create vs Enrich](#import-mode-create-vs-enrich)
5. [Entity Matching: Auto-Create Approach](#entity-matching-auto-create-approach)
6. [Import Flow: Fire-and-Forget Architecture](#import-flow-fire-and-forget-architecture)
7. [User Experience: Modal with Job History](#user-experience-modal-with-job-history)
8. [Error Handling & Correction Workflow](#error-handling--correction-workflow)
9. [Data Structures](#data-structures)
10. [Implementation Phases](#implementation-phases)
11. [Decisions Made](#decisions-made)

---

## Executive Summary

This document outlines the complete refactor of the Avelero bulk import system. The refactor addresses several major changes:

1. **Template Format Change**: Moving from CSV to Excel (XLSX) format
2. **Template Structure Change**: Adopting Shopify-style row structure with `product_handle` as the key differentiator
3. **Attribute System Change**: Replacing fixed color/size variants with generalizable attributes and attribute values
4. **Variant-Level Overrides**: Any product-level field filled on a child row becomes a variant-level override
5. **Import Modes**: Explicit "Create" vs "Enrich" modes with different behaviors
6. **Fire-and-Forget Flow**: No user confirmation required; successful products commit automatically
7. **Error Correction**: Red cell highlighting in Excel exports for failed rows

---

## New Excel Template Structure

### Template File
- **Filename:** `Avelero Bulk Import Template.xlsx`
- **Location:** `apps/api/public/templates/avelero-bulk-import-template.xlsx`

### Column Definitions

#### Product-Level Columns

| Column | Required | Description | Entity Type | Can Override at Variant? |
|--------|----------|-------------|-------------|--------------------------|
| Product Title | Yes (parent) | Display name of the product | - | ✅ Yes |
| Product Handle | Yes (parent) | URL-friendly identifier (**KEY DIFFERENTIATOR**) | - | ❌ No |
| Manufacturer | No | Name of the manufacturer/brand | `brand_manufacturers` | ❌ No |
| Description | No | Product description | - | ✅ Yes |
| Image | No | URL to product image | - | ✅ Yes |
| Image Status | No | Publication status | - | ❌ No |
| Category | No | Category path (e.g., "Clothing > T-shirts") | `taxonomy_categories` | ❌ No |
| Season | No | Season name (e.g., "NOS", "SS26") | `brand_seasons` | ❌ No |
| Tags | No | Pipe-separated tags | `brand_tags` | ❌ No |

#### Variant-Level Columns

| Column | Required | Description | Entity Type |
|--------|----------|-------------|-------------|
| Barcode | Yes* | Product barcode (EAN/UPC) | - |
| SKU | Yes* | Stock Keeping Unit | - |
| Attribute 1 | No | First attribute name (e.g., "Color") | `brand_attributes` |
| Attribute Value 1 | No | First attribute value (e.g., "White") | `brand_attribute_values` |
| Attribute 2 | No | Second attribute name (e.g., "Size") | `brand_attributes` |
| Attribute Value 2 | No | Second attribute value (e.g., "M") | `brand_attribute_values` |
| Attribute 3 | No | Third attribute name | `brand_attributes` |
| Attribute Value 3 | No | Third attribute value | `brand_attribute_values` |

*At least one of Barcode or SKU is required for variant identification.

#### Sustainability & Environmental Columns

| Column | Required | Description | Entity Type |
|--------|----------|-------------|-------------|
| Kilograms CO2 | No | Carbon footprint in kg CO2 | - |
| Carbon Footprint | No | Carbon footprint description/status | - |
| Liters Water Used | No | Water usage in liters | - |
| Eco Claims | No | Pipe-separated eco claims | `brand_eco_claims` |
| Grams Weight | No | Product weight in grams | - |
| Materials Percentages | No | Material composition (complex format) | `brand_materials` |

#### Production Journey Columns

| Column | Required | Description | Entity Type |
|--------|----------|-------------|-------------|
| Raw Material | No | Operator name for raw material step | `brand_facilities` |
| Weaving | No | Operator name for weaving step | `brand_facilities` |
| Dyeing/Printing | No | Operator name for dyeing/printing step | `brand_facilities` |
| Stitching | No | Operator name for stitching step | `brand_facilities` |
| Assembly | No | Operator name for assembly step | `brand_facilities` |
| Finishing | No | Operator name for finishing step | `brand_facilities` |

---

## Row Grouping & Variant-Level Overrides

### The Key Rule: `Product Handle` is the Differentiator

```
IF row has a value in "Product Handle" column:
    → This is a PARENT ROW (start of new product group)
    
IF row does NOT have a value in "Product Handle" column:
    → This is a CHILD ROW (variant belonging to the most recent parent)
```

### Parent Row (Product Row)

- Contains the `product_handle` value
- Contains all product-level data (title, manufacturer, description, image, category, season, tags)
- Also contains the first variant's data (barcode, SKU, attributes)
- This first variant inherits all product-level values unless overridden

### Child Row (Variant Row)

- Does NOT contain a `product_handle` value
- Belongs to the most recent parent row above it
- Contains variant-specific data (barcode, SKU, attributes)
- **Variant-Level Overrides**: If any product-level field is filled on a child row, it becomes an override for that specific variant

### Variant-Level Override Logic

| Scenario | Result |
|----------|--------|
| Parent has "Blue T-Shirt", child has empty title | Variant inherits "Blue T-Shirt" |
| Parent has "Blue T-Shirt", child has "Blue T-Shirt - XL" | Variant uses "Blue T-Shirt - XL" (override) |
| Parent has description, child has empty description | Variant inherits parent description |
| Parent has description, child has different description | Variant uses child description (override) |
| Parent has image URL, child has different image URL | Variant uses child image (override) |

### Example Excel Structure

| Product Title | Product Handle | Manufacturer | Description | Barcode | SKU | Attribute 1 | Attribute Value 1 |
|---------------|----------------|--------------|-------------|---------|-----|-------------|-------------------|
| Organic Cotton T-Shirt | organic-cotton-tshirt | Avelero Apparel | Great organic t-shirt | 115243746 | SKU-OCT-001 | Color | White |
| | | | | 115243747 | SKU-OCT-002 | Color | White |
| | | | | 115243748 | SKU-OCT-003 | Color | Black |
| Organic Cotton T-Shirt - Special Edition | | | Limited edition desc | 115243749 | SKU-OCT-004 | Color | Black |
| Recycled Denim Jeans | recycled-denim-jeans | Avelero Apparel | Comfortable jeans | 224363542 | SKU-RDJ-001 | Size | S |

**Interpretation:**
- Row 1: Parent product "Organic Cotton T-Shirt" with first variant (SKU-OCT-001)
- Row 2-3: Child variants inheriting all parent values
- Row 4: Child variant with **variant-level override** for title and description
- Row 5: New parent product "Recycled Denim Jeans" with first variant

### Grouping Algorithm (Pseudocode)

```typescript
function parseExcelRows(rows: ExcelRow[]): ProductGroup[] {
  const productGroups: ProductGroup[] = [];
  let currentProduct: ProductGroup | null = null;
  
  for (const row of rows) {
    const hasProductHandle = row['Product Handle']?.trim();
    
    if (hasProductHandle) {
      // Start new product group
      currentProduct = {
        product: extractProductData(row),
        variants: [extractVariantData(row, null)] // First variant, no overrides
      };
      productGroups.push(currentProduct);
    } else {
      // Child row - belongs to current product
      if (!currentProduct) {
        throw new Error('Child row found before any parent row');
      }
      
      // Extract variant with potential overrides
      const variant = extractVariantData(row, currentProduct.product);
      currentProduct.variants.push(variant);
    }
  }
  
  return productGroups;
}

function extractVariantData(row: ExcelRow, parentProduct: Product | null): Variant {
  return {
    barcode: row['Barcode'],
    sku: row['SKU'],
    attributes: extractAttributes(row),
    
    // Variant-level overrides (only if child row has values)
    nameOverride: row['Product Title']?.trim() || null,
    descriptionOverride: row['Description']?.trim() || null,
    imagePathOverride: row['Image']?.trim() || null,
  };
}
```

---

## Import Mode: Create vs Enrich

### Overview

| Aspect | Create Mode | Enrich Mode |
|--------|-------------|-------------|
| **Purpose** | Create new products from scratch | Update existing products |
| **Product Matching** | Never matches; always creates new | Matches by SKU or Barcode |
| **Creates Products** | ✅ Yes | ❌ No |
| **Creates Variants** | ✅ Yes | ❌ No |
| **Creates Attributes** | ✅ Yes | ❌ No |
| **Creates Attribute Values** | ✅ Yes | ❌ No |
| **Edits Product Data** | ✅ Yes | ✅ Yes |
| **Edits Variant Data** | ✅ Yes | ✅ Yes |

### Enrich Mode: What Can Be Edited

**Important**: Enrich mode is NOT limited to sustainability data. It can edit/enrich **ALL fields** except:
- `Product Handle` (used for matching, cannot change)
- Attributes and Attribute Values (create-mode only)
- Barcode/SKU (used for matching, cannot change)

**Enrich Mode CAN update:**
- Product Title
- Description
- Image/Image URL
- Category
- Season
- Tags
- Manufacturer
- All environmental data (CO2, water usage, etc.)
- Materials composition
- Production journey steps
- Eco claims
- Weight

### Create Mode Behavior

```
For each product group in file:
  1. Generate new product ID
  2. Create new product record with all product-level fields
  3. For each variant in group:
     a. Generate new variant ID
     b. Create variant record with overrides (if any)
     c. Create/match attributes and attribute values
     d. Assign attributes to variant
     e. Create related records (materials, journey, eco claims, etc.)
```

### Enrich Mode Behavior

```
For each product group in file:
  1. For each variant in group:
     a. Match variant by SKU or Barcode
     b. If no match found:
        → Mark row as error: "Variant not found"
     c. If match found:
        → Update product-level fields (via the matched product)
        → Update variant-level fields
        → Update related records (materials, journey, etc.)
        → DO NOT touch: attributes, attribute values
```

---

## Entity Matching: Auto-Create Approach

### Decision: Auto-Create with Post-Import Enrichment

When an entity reference (e.g., manufacturer name, season name, material name) is not found in the brand's existing data, we **automatically create a minimal entity** with just the name.

### Rationale

1. **Reduces friction significantly** - Users don't need to pre-create every entity
2. **Fire-and-forget compatible** - Import can complete without user intervention
3. **Progressive enrichment** - Users can enrich entity details later in their dashboard
4. **Matches user expectations** - Similar to how Shopify handles tag creation

### Entity Creation Rules

| Entity Type | Match By | Auto-Create? | Created Fields |
|-------------|----------|--------------|----------------|
| `brand_manufacturers` | `name` (case-insensitive) | ✅ Yes | `name` only |
| `brand_seasons` | `name` (case-insensitive) | ✅ Yes | `name` only |
| `brand_tags` | `name` (case-insensitive) | ✅ Yes | `name` only |
| `brand_attributes` | `name` (case-insensitive) | ✅ Yes | `name` only |
| `brand_attribute_values` | `name` + `attributeId` | ✅ Yes | `name`, `attributeId` |
| `brand_facilities` | `name` (case-insensitive) | ✅ Yes | `name` only |
| `brand_materials` | `name` (case-insensitive) | ✅ Yes | `name` only |
| `brand_eco_claims` | `name` (case-insensitive) | ✅ Yes | `name` only |
| `taxonomy_categories` | Full path | ❌ **NO** | Error if not found |

### Special Case: Categories

Categories are pre-seeded and hierarchical. They **cannot be auto-created**.
- If category path doesn't match an existing taxonomy category → **Error the row**
- User must correct the category path or remove it

---

## Import Flow: Fire-and-Forget Architecture

### Key Insight

Users should not need to "confirm" an import. They want to:
1. Upload the file
2. Close the modal
3. Come back later and see results

Even if some products fail, users still want the successful ones to be imported.

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           IMPORT FLOW                                       │
└─────────────────────────────────────────────────────────────────────────────┘

User clicks "Import" button
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  MODAL: Import Products                                                     │
│                                                                             │
│  ┌── Recent Imports ─────────────────────────────────────────────────────┐  │
│  │  (Shows last 5 import jobs with status)                               │  │
│  │  ⚠️ Jan 9, 10:30 - 5/100 failed [Download Corrections] [Dismiss]     │  │
│  │  ✅ Jan 8, 3:15 - 50 products imported                                │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ── New Import ──────────────────────────────────────────────────────────   │
│  [Via Integration]  [Manual Bulk Import]                                    │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        ▼ (user selects "Manual Bulk Import")
        
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. [Download Template] (pre-filled with example products)                  │
│  2. Fill in your products                                                   │
│  3. Upload: [Choose File]                                                   │
│     Mode: ( ) Create Products  ( ) Enrich Existing Products                 │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        ▼ (file selected, mode chosen)
        
┌─────────────────────────────────────────────────────────────────────────────┐
│  QUICK VALIDATION (client-side + server-side)                               │
│  ├── Is it a valid XLSX file?                                               │
│  ├── Are required columns present?                                          │
│  ├── Do rows have SKU or Barcode?                                           │
│  └── Any duplicate identifiers in file?                                     │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        ▼ (validation passes)
        
┌─────────────────────────────────────────────────────────────────────────────┐
│  File uploaded to storage bucket                                            │
│  Background job triggered                                                   │
│                                                                             │
│  MODAL SHOWS:                                                               │
│  "Import started! Processing X products in background."                     │
│  [Close]  [View Progress]                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        ├──────────────────────────────┬───────────────────────────────────────┐
        │                              │                                       │
        ▼ (user closes modal)          ▼ (user clicks View Progress)           │
                                                                               │
┌─────────────────────┐    ┌───────────────────────────────────────────────────┐
│  Background job     │    │  Progress bar via WebSocket                       │
│  continues silently │    │  "Processing row 45 of 100..."                    │
│                     │    │  When complete: Summary shown                     │
└─────────────────────┘    └───────────────────────────────────────────────────┘
        │                              │
        └──────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BACKGROUND JOB: validate-and-stage                                         │
│                                                                             │
│  For each row:                                                              │
│    ├── Parse product/variant grouping                                       │
│    ├── Validate all fields                                                  │
│    ├── Match/auto-create entities                                           │
│    ├── Check for variant-level overrides                                    │
│    └── Write to staging table                                               │
│                                                                             │
│  Result: Staging tables populated with validation results per row           │
└─────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  AUTOMATIC COMMIT (no user confirmation required)                           │
│                                                                             │
│  For each VALID staging row:                                                │
│    ├── Create/update product in production table                            │
│    ├── Create/update variants in production table                           │
│    ├── Assign attributes, create related records                            │
│    └── Delete from staging table                                            │
│                                                                             │
│  For each FAILED staging row:                                               │
│    └── Keep in staging table (for export)                                   │
│                                                                             │
│  Update job status: COMPLETED or COMPLETED_WITH_FAILURES                    │
└─────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  JOB COMPLETE                                                               │
│                                                                             │
│  If 100% success:                                                           │
│    Status: COMPLETED                                                        │
│    All staging data cleaned up                                              │
│                                                                             │
│  If partial success (some failures):                                        │
│    Status: COMPLETED_WITH_FAILURES                                          │
│    Failed rows remain in staging (for correction export)                    │
│    User sees this when they open Import modal again                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Status Values

| Status | Description |
|--------|-------------|
| `PENDING` | Job created, awaiting background processing |
| `PROCESSING` | Background job actively running |
| `COMPLETED` | All rows imported successfully |
| `COMPLETED_WITH_FAILURES` | Some rows imported, some failed |
| `FAILED` | Job itself failed (system error) |

---

## User Experience: Modal with Job History

### The Approach: "Recent Imports" Section in Import Modal

When a user opens the Import modal, it shows two sections:

1. **Recent Imports**: Last 5 import jobs with their status
2. **New Import**: Options to start a new import

### Modal Wireframe

```
┌─────────────────────────────────────────────────────────────────┐
│  Import Products                                           [X]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ Recent Imports ─────────────────────────────────────────┐   │
│  │                                                          │   │
│  │  ⚠️  Jan 9, 10:30 AM - 5 of 100 products failed         │   │
│  │      [Download Corrections]  [Dismiss]                   │   │
│  │                                                          │   │
│  │  ✅ Jan 8, 3:15 PM - 50 products imported successfully  │   │
│  │                                                          │   │
│  │  ✅ Jan 7, 2:00 PM - 25 products imported successfully  │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Start New Import                                               │
│                                                                 │
│  How would you like to import products?                         │
│                                                                 │
│  [📦 Via Integration]     [📄 Manual Bulk Import]              │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Manual Import Steps:                                           │
│  1. [Download Template]                                         │
│  2. Fill in your products                                       │
│  3. Upload and choose mode:                                     │
│     [Upload File ▼]                                            │
│     ( ) Create Products  ( ) Enrich Existing                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Visual Indicator on Import Button

Add a small indicator on the "Import" button when there are actionable failed imports:

```
Product List Header:
[+ Add Product]  [Import 🔴]  [Export]
              ↑
              Red dot indicates "you have failed imports that need attention"
```

### Why This Works

1. **Contextual**: Users see import history when they're thinking about imports
2. **No new pages**: Everything lives in the existing modal
3. **Fire-and-forget compatible**: User uploads, closes, comes back later
4. **Clear action path**: Failed imports have obvious "Download Corrections" button
5. **Self-cleaning**: Completed imports fade from view over time

### Staging Data Lifecycle

| Scenario | Staging Data Behavior |
|----------|----------------------|
| Row validates successfully | Committed to production → Deleted from staging |
| Row fails validation | Kept in staging for correction export |
| User downloads corrections | Staging data kept for 7 more days |
| User dismisses failed import | Staging data deleted immediately |
| 30 days pass without action | Staging data auto-deleted (cleanup job) |

---

## Error Handling & Correction Workflow

### Error Types

| Error Type | Severity | Blocks Row | Description |
|------------|----------|------------|-------------|
| `MISSING_REQUIRED_FIELD` | Error | Yes | SKU or Barcode missing |
| `DUPLICATE_IDENTIFIER` | Error | Yes | Duplicate SKU/Barcode in file |
| `INVALID_FORMAT` | Error | Yes | Invalid data format (e.g., invalid URL) |
| `CATEGORY_NOT_FOUND` | Error | Yes | Category path doesn't match taxonomy |
| `VARIANT_NOT_FOUND` | Error | Yes (Enrich) | No match for SKU/Barcode |
| `ENTITY_AUTO_CREATED` | Info | No | New entity was auto-created |

### Correction Export Workflow

When an import has failures, users can download a correction Excel file:

1. **Click "Download Corrections"** in the Recent Imports section
2. **Excel file is generated** with:
   - All original rows (both successful and failed)
   - Failed cells highlighted with red background (`#FFE0E0`)
   - **No Excel comments** (just the cell coloring)
3. **User corrects the red cells** in their Excel application
4. **User re-uploads** the corrected file
5. **System re-validates the entire sheet** (since user might have changed other things too)

### Excel Formatting for Corrections

```
| Product Title | SKU | Category | ... |
|---------------|-----|----------|-----|
| Good Product  | SKU-001 | Clothing > Shirts | ... |   ← This row is fine
| [🔴 RED]      | [🔴 RED] | [🔴 RED] Men's > Invalid | ...   ← Failed row
```

**Technical Implementation:**
- Use `exceljs` library for Excel generation
- Apply red fill to cells with errors: `{ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0E0' } }`
- No comments needed (simpler implementation)

---

## Data Structures

### Import Job (Updated)

```typescript
interface ImportJob {
  id: string;
  brandId: string;
  filename: string;
  mode: 'CREATE' | 'ENRICH';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'COMPLETED_WITH_FAILURES' | 'FAILED';
  startedAt: string;
  finishedAt?: string;
  
  // Summary stored as JSONB
  summary: {
    totalRows: number;
    successfulRows: number;
    failedRows: number;
    productsCreated: number;
    productsUpdated: number;
    variantsCreated: number;
    variantsUpdated: number;
    entitiesAutoCreated: {
      type: string;  // 'manufacturer', 'season', 'tag', etc.
      name: string;
      id: string;
    }[];
  };
  
  // For failed imports, track which rows failed
  hasExportableFailures: boolean;
}
```

### Staging Product

```typescript
interface StagingProduct {
  stagingId: string;
  jobId: string;
  rowNumber: number;
  action: 'CREATE' | 'UPDATE';
  status: 'PENDING' | 'COMMITTED' | 'FAILED';
  existingProductId?: string;
  
  // Product fields
  id: string;
  brandId: string;
  name: string;
  productHandle: string;
  description?: string;
  manufacturerId?: string;
  imagePath?: string;
  categoryId?: string;
  seasonId?: string;
  
  // Validation errors (JSONB)
  errors: {
    field: string;
    message: string;
  }[];
}
```

### Staging Variant

```typescript
interface StagingVariant {
  stagingId: string;
  stagingProductId: string;
  jobId: string;
  rowNumber: number;
  action: 'CREATE' | 'UPDATE';
  status: 'PENDING' | 'COMMITTED' | 'FAILED';
  existingVariantId?: string;
  
  // Variant fields
  id: string;
  productId: string;
  barcode?: string;
  sku?: string;
  
  // Variant-level overrides
  nameOverride?: string;
  descriptionOverride?: string;
  imagePathOverride?: string;
  
  // Validation errors (JSONB)
  errors: {
    field: string;
    message: string;
  }[];
}
```

### Staging Variant Attributes (NEW)

```typescript
interface StagingVariantAttribute {
  stagingId: string;
  stagingVariantId: string;
  jobId: string;
  attributeId: string;
  attributeValueId: string;
  sortOrder: number;
}
```

---

## Implementation Phases

### Phase 1: Database Migrations

**Priority:** 🔴 Critical - Must be done first

**Tasks:**
1. Add `mode` column to `import_jobs` table
2. Update `status` enum to include new values (`PROCESSING`, `COMPLETED_WITH_FAILURES`)
3. Add `hasExportableFailures` column to `import_jobs`
4. Create `staging_variant_attributes` table
5. Add `nameOverride`, `descriptionOverride`, `imagePathOverride` to `staging_product_variants`
6. Add `status` and `errors` columns to staging tables (for per-row status tracking)

### Phase 2: Excel Parser Implementation

**Priority:** 🔴 Critical

**Tasks:**
1. Install `exceljs` library
2. Create `packages/jobs/src/lib/excel-parser.ts`:
   - Parse XLSX files
   - Implement Shopify-style row grouping (product_handle as key)
   - Extract variant-level overrides
3. Create `packages/jobs/src/lib/excel-export.ts`:
   - Generate correction Excel with red cell highlighting
   - Apply formatting without comments

### Phase 3: Background Job Updates

**Priority:** 🔴 Critical

**Tasks:**
1. Update `validate-and-stage.ts`:
   - Replace CSV parsing with Excel parsing
   - Implement product_handle-based grouping
   - Add mode-specific validation (Create vs Enrich)
   - Implement auto-entity creation
   - Track per-row status
2. Update `commit-to-production.ts`:
   - Auto-commit successful rows (no user confirmation)
   - Keep failed rows in staging
   - Update job status appropriately

### Phase 4: API Updates

**Priority:** 🟡 High

**Tasks:**
1. Update `apps/api/src/trpc/routers/bulk/import.ts`:
   - Accept `mode` parameter
   - Add `exportCorrections` procedure
   - Add `dismissFailedImport` procedure
   - Add `getRecentImports` procedure
2. Update validation logic for Excel format

### Phase 5: Query Updates

**Priority:** 🟡 High

**Tasks:**
1. Update staging queries for new attribute structure
2. Add queries for correction export generation
3. Add cleanup queries for staging data lifecycle

### Phase 6: UI Changes (Manual)

**Priority:** 🟢 Normal - Done by user

**Tasks:**
1. Update import modal:
   - Add "Recent Imports" section
   - Add mode selection (Create/Enrich)
   - Add download corrections button
   - Add dismiss button
2. Add indicator dot on Import button when failures exist
3. Update progress UI

---

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Row differentiator | `product_handle` column | Clear, consistent with Shopify logic |
| Entity not found | Auto-create with name only | Reduces friction, allows post-import enrichment |
| Category not found | Error the row | Categories are hierarchical, can't auto-create |
| User confirmation | Not required (fire-and-forget) | Better UX, users rarely cancel anyway |
| Partial success | Import successful, keep failed in staging | Users want successful products imported regardless |
| Failed rows surfacing | "Recent Imports" in import modal | Contextual, no new pages needed |
| Error cell comments | No comments, just red background | Simpler implementation |
| Enrich mode scope | All fields except attributes/handle | Full flexibility to update any data |

---

## Appendix A: Column Mapping

```typescript
const COLUMN_MAPPING = {
  // Product-level (only from parent rows)
  'Product Title': { path: 'product.name', canOverride: true },
  'Product Handle': { path: 'product.productHandle', canOverride: false },
  'Manufacturer': { path: 'product.manufacturerId', canOverride: false, entity: 'brand_manufacturers' },
  'Description': { path: 'product.description', canOverride: true },
  'Image': { path: 'product.imagePath', canOverride: true },
  'Image Status': { path: 'product.status', canOverride: false },
  'Category': { path: 'product.categoryId', canOverride: false, entity: 'taxonomy_categories' },
  'Season': { path: 'product.seasonId', canOverride: false, entity: 'brand_seasons' },
  'Tags': { path: 'product.tags', canOverride: false, entity: 'brand_tags', multi: true },
  
  // Variant-level (from all rows)
  'Barcode': { path: 'variant.barcode' },
  'SKU': { path: 'variant.sku' },
  'Attribute 1': { path: 'variant.attribute1Name', entity: 'brand_attributes' },
  'Attribute Value 1': { path: 'variant.attribute1Value', entity: 'brand_attribute_values' },
  'Attribute 2': { path: 'variant.attribute2Name', entity: 'brand_attributes' },
  'Attribute Value 2': { path: 'variant.attribute2Value', entity: 'brand_attribute_values' },
  'Attribute 3': { path: 'variant.attribute3Name', entity: 'brand_attributes' },
  'Attribute Value 3': { path: 'variant.attribute3Value', entity: 'brand_attribute_values' },
  
  // Environmental (variant-level)
  'Kilograms CO2': { path: 'variant.environment.carbonKg' },
  'Carbon Footprint': { path: 'variant.environment.carbonStatus' },
  'Liters Water Used': { path: 'variant.environment.waterLiters' },
  'Eco Claims': { path: 'variant.ecoClaims', entity: 'brand_eco_claims', multi: true },
  'Grams Weight': { path: 'variant.weight.grams' },
  'Materials Percentages': { path: 'variant.materials', complex: true },
  
  // Production Journey (variant-level)
  'Raw Material': { path: 'variant.journey.raw-material', entity: 'brand_facilities' },
  'Weaving': { path: 'variant.journey.weaving', entity: 'brand_facilities' },
  'Dyeing/Printing': { path: 'variant.journey.dyeing-printing', entity: 'brand_facilities' },
  'Stitching': { path: 'variant.journey.stitching', entity: 'brand_facilities' },
  'Assembly': { path: 'variant.journey.assembly', entity: 'brand_facilities' },
  'Finishing': { path: 'variant.journey.finishing', entity: 'brand_facilities' },
};
```

---

## Document Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-09 | Initial document creation |
| 2.0 | 2026-01-09 | Major revision: product_handle as row differentiator, enrich mode full scope, fire-and-forget flow, modal history UX, no Excel comments, auto-create entities confirmed |
