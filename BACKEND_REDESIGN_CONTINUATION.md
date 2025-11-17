# Backend Redesign Implementation - Continuation Guide

## Context
This document provides the exact state of the backend redesign implementation based on `proposal.md`. Use this to continue the work in a new Claude Code session.

## What Has Been Completed ✅

### 1. Database Migration & Schema Updates
**File**: `apps/api/supabase/migrations/20251117140714_backend_redesign.sql`

**Changes Made**:
- ✅ `brand_facilities`: Dropped `contact`, `vat_number`; renamed `address` → `address_line_1`; added `address_line_2`, `phone`, `email`, `state`, `zip`
- ✅ `brand_sizes`: Dropped `category_group` column
- ✅ `product_variants`: Dropped `sku`, `product_image_url`, `ean`, `status` columns
- ✅ `products`: Dropped `season`, `brand_certification_id`, `additional_image_urls`, `tags`; added `template_id`
- ✅ `staging_product_variants`: Updated to match production table changes
- ✅ `staging_products`: Updated to match production table changes
- ✅ `tags_on_product`: Added `updated_at` column
- ✅ `users`: Dropped `role` column (role now in `users_on_brand`)
- ✅ All RLS policies updated to include `service_role`
- ✅ Dropped tables: `care_codes`, `passports`, `passport_module_completion`, `product_identifiers`, `product_variant_identifiers`, `product_care_codes`, and their staging equivalents

**Schema Files Updated**:
- ✅ `packages/db/src/schema/brands/brand-facilities.ts`
- ✅ `packages/db/src/schema/brands/brand-sizes.ts`
- ✅ `packages/db/src/schema/products/products.ts`
- ✅ `packages/db/src/schema/products/product-variants.ts`
- ✅ `packages/db/src/schema/products/tags-on-product.ts`
- ✅ `packages/db/src/schema/core/users.ts`
- ✅ `packages/db/src/schema/data/staging-tables.ts`
- ✅ `packages/db/src/schema/index.ts` (removed exports for deleted tables)

### 2. Router Restructuring

**Products Router** (`apps/api/src/trpc/routers/products/index.ts`):
- ✅ Removed nested `variants` router
- ✅ Removed `productAttributesRouter` (it was never mounted, attributes were always in products)
- ✅ Updated `products.create` to include attribute setting logic (materials, ecoClaims, environment, journeySteps)
- ✅ Updated `products.update` to remove deprecated fields: `season`, `brandCertificationId`, `careCodes`
- ✅ Updated to use `templateId` instead of deprecated fields

**Passports Router** (`apps/api/src/trpc/routers/passports/index.ts`):
- ✅ Removed nested `templates` router
- ✅ Already had all CRUD operations (list, get, create, update, delete)

**Templates Router** (NEW: `apps/api/src/trpc/routers/templates/index.ts`):
- ✅ Created standalone top-level router (moved from `passports.templates`)
- ✅ Full CRUD: list, get, create, update, delete

**Summary Router** (NEW: `apps/api/src/trpc/routers/summary/index.ts`):
- ✅ Created new router for aggregated statistics
- ✅ Endpoints: `overview`, `products`, `templates`
- ✅ Provides completion rates, status counts, module statistics

**Main App Router** (`apps/api/src/trpc/routers/_app.ts`):
- ✅ Added `templates` router at root level
- ✅ Added `summary` router at root level
- ✅ Updated documentation comments

### 3. Query File Reorganization

**Brand Catalog** (`packages/db/src/queries/brand-catalog.ts`):
- ✅ Updated `createFacility` and `updateFacility` to use new fields (addressLine1, addressLine2, phone, email, state, zip)
- ✅ Updated size functions to remove `categoryGroup` references (partial - needs full cleanup)
- ✅ Added season functions: `listSeasonsForBrand`, `getSeasonById`, `createSeason`, `updateSeason`, `deleteSeason`
- ✅ Imported `brandSeasons` schema

## What Needs To Be Done 📋

### CRITICAL: Type Errors (59 errors identified)
These errors MUST be fixed before the code will compile:

#### 1. Brand Catalog Issues
**Files**: `packages/db/src/queries/brand-catalog.ts`
- ❌ Remove ALL `categoryGroup` references (38 occurrences across codebase)
- ❌ Update size queries at lines ~757-780, 904-924 that still reference `categoryGroup`

#### 2. Products Query File Issues
**File**: `packages/db/src/queries/products.ts`
- ❌ Remove imports: `careCodes`, `productCareCodes`, `productIdentifiers`, `productVariantIdentifiers`
- ❌ Remove `season` field usage (use `seasonId` instead)
- ❌ Remove `brandCertificationId` field usage
- ❌ Remove variant fields: `sku`, `ean`, `status`, `productImageUrl` in queries at lines 286-290, 856-860, 917, 977, 1032, 1180, 1228-1237

#### 3. Staging Query File Issues
**File**: `packages/db/src/queries/staging.ts`
- ❌ Remove `additionalImageUrls`, `tags`, `season`, `brandCertificationId` from staging_products inserts (lines 252, 1009-1010)
- ❌ Remove `sku`, `ean`, `status`, `productImageUrl` from staging_product_variants (lines 346, 932-936)

#### 4. Completion Files Issues
**Files**: `packages/db/src/completion/*.ts`
- ❌ `evaluate.ts`: Remove `passportModuleCompletion`, `passports` imports
- ❌ `template-sync.ts`: Remove `passports` import
- ❌ `rules.ts`: Remove `sku` reference from product_variants (line 47)

#### 5. Catalog Query File Issues
**File**: `packages/db/src/queries/catalog.ts`
- ❌ Remove `careCodes` import
- ❌ Remove `listCareCodes` function

#### 6. Passports Query File
**File**: `packages/db/src/queries/passports.ts`
- ❌ Remove entire file or refactor (references deleted `passports`, `passportModuleCompletion` tables)
- ❌ Remove `season` and `sku` field usage at lines 474, 477, 536, 539

#### 7. Product Attributes Query File
**File**: `packages/db/src/queries/product-attributes.ts`
- ❌ Remove entire file (references deleted `productCareCodes` table)

### File Creation Tasks

#### 1. Create Product Variants Query File
**File**: `packages/db/src/queries/product-variants.ts`
- ❌ Create new file
- ❌ Move variant-specific queries from `products.ts`:
  - `listVariantsForProduct`
  - `getVariantById`
  - `createVariant`
  - `updateVariant`
  - `deleteVariant`
  - `bulkCreateVariants`
- ❌ Update to remove deprecated fields: `sku`, `ean`, `status`, `productImageUrl`

#### 2. Delete Deprecated Query Files
- ❌ Delete `packages/db/src/queries/seasons.ts` (functions moved to brand-catalog.ts)
- ❌ Delete `packages/db/src/queries/passports.ts` (table no longer exists)
- ❌ Delete `packages/db/src/queries/product-attributes.ts` (functionality integrated into products)

#### 3. Update Query Index
**File**: `packages/db/src/queries/index.ts`
- ❌ Remove export: `export * from "./seasons.js";` (line 14)
- ❌ Remove export: `export * from "./passports.js";` (line 9)
- ❌ Remove export: `export * from "./product-attributes.js";` (line 8)
- ❌ Add export: `export * from "./product-variants.js";`

### Schema/Router Updates

#### 1. Update tRPC Schemas
**Files**: `apps/api/src/schemas/*.ts`

Need to update these schema files to match new table structures:

**products.ts**:
- ❌ Remove `season` field (use `season_id`)
- ❌ Remove `brand_certification_id` field
- ❌ Remove `additional_image_urls` field
- ❌ Remove `tags` field
- ❌ Add `template_id` field
- ❌ Remove `careCodes` from update schema

**product-attributes.ts**:
- ❌ Remove `setCareCodesSchema` (care codes deprecated)

**Check other schemas for**:
- ❌ Variant schemas referencing `sku`, `ean`, `status`, `productImageUrl`
- ❌ Brand facility schemas using old address fields
- ❌ Size schemas using `categoryGroup`

### Testing & Validation

#### 1. Type Check & Fix All Errors
```bash
cd packages/db && npx tsc --noEmit
```
- ❌ Fix all 59 type errors identified
- ❌ Ensure zero TypeScript errors

#### 2. Lint
```bash
npm run lint
```
- ❌ Fix all linting issues

#### 3. Build
```bash
npm run build
```
- ❌ Ensure successful compilation

#### 4. Test Migration
```bash
# Connect to dev database and run migration
psql <connection-string>
\i apps/api/supabase/migrations/20251117140714_backend_redesign.sql
```
- ❌ Verify migration runs without errors
- ❌ Verify data integrity after migration
- ❌ Test RLS policies work with service_role

## Important Notes

### CategoryGroup Removal Impact
The `categoryGroup` field was heavily used (38 occurrences). Its removal is a **breaking change** that affects:
- Size filtering logic
- Size creation/update flows
- Validation functions
- Frontend components likely depend on this

**Recommendation**: Either:
1. Revert the categoryGroup removal and keep it in the schema
2. Or create a comprehensive refactor plan to replace all categoryGroup logic with categoryId-based approach

### Care Codes Removal Impact
Care codes table and all references are being removed. Ensure:
- No production data relies on care codes
- Frontend doesn't display care code information
- Any bulk import flows don't expect care codes

### Passport Table Removal Impact
The `passports` table is being removed. According to proposal, passport logic moves to products via `template_id`. Ensure:
- Migration strategy for existing passport data
- Passport-related queries are refactored to use products.template_id
- Frontend passport views are updated

## Quick Start Commands

```bash
# Navigate to project
cd /home/tr4moryp/Projects/projects/Avelero_V3/avelero

# Check current type errors
cd packages/db && npx tsc --noEmit 2>&1 | grep -E "error TS[0-9]+" | wc -l

# See all errors
cd packages/db && npx tsc --noEmit

# After fixes, run full validation
npm run type-check
npm run lint
npm run build
```

## Files Modified So Far

### Schema Files
- `packages/db/src/schema/brands/brand-facilities.ts`
- `packages/db/src/schema/brands/brand-sizes.ts`
- `packages/db/src/schema/core/users.ts`
- `packages/db/src/schema/data/staging-tables.ts`
- `packages/db/src/schema/products/products.ts`
- `packages/db/src/schema/products/product-variants.ts`
- `packages/db/src/schema/products/tags-on-product.ts`
- `packages/db/src/schema/index.ts`

### Router Files
- `apps/api/src/trpc/routers/_app.ts`
- `apps/api/src/trpc/routers/products/index.ts`
- `apps/api/src/trpc/routers/passports/index.ts`
- `apps/api/src/trpc/routers/templates/index.ts` (NEW)
- `apps/api/src/trpc/routers/summary/index.ts` (NEW)

### Query Files
- `packages/db/src/queries/brand-catalog.ts`

### Migration Files
- `apps/api/supabase/migrations/20251117140714_backend_redesign.sql` (NEW)

## Next Steps Priority Order

1. **Fix critical type errors** in products.ts, staging.ts, brand-catalog.ts
2. **Delete deprecated files** (passports.ts, product-attributes.ts, seasons.ts)
3. **Create product-variants.ts** query file
4. **Update tRPC schemas** to match new structures
5. **Run full type-check** and fix remaining errors
6. **Test migration** on dev database
7. **Run lint and build**

## Reference
- Original proposal: `/home/tr4moryp/Projects/projects/Avelero_V3/avelero/proposal.md`
- Migration file: `apps/api/supabase/migrations/20251117140714_backend_redesign.sql`
