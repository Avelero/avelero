# Immutable Passports Implementation Progress

This document tracks the progress of implementing the Immutable Passports feature. Each completed step should be logged below with details about changes made, validation results, and any notes.

---

## Progress Log

<!-- Progress entries will be appended below this line -->

## Phase 1 - Database Schema - Publishing Layer
**Completed**: 2026-01-16T12:45:00+01:00

### Step 1.1: Create Product Passports Table Schema
**File Created**: `packages/db/src/schema/products/product-passports.ts`

Created the `product_passports` table with:
- `id`: UUID PRIMARY KEY
- `upid`: VARCHAR UNIQUE NOT NULL - Universal Product Identifier for public URLs
- `brand_id`: UUID NOT NULL FK → brands (NO CASCADE DELETE - critical for immutability)
- `working_variant_id`: UUID FK → product_variants ON DELETE SET NULL
- `current_version_id`: UUID (nullable, set after first publish)
- `first_published_at`: TIMESTAMPTZ NOT NULL
- `last_published_at`: TIMESTAMPTZ NOT NULL
- `created_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW()
- `updated_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW()

### Step 1.2: Create Product Passport Versions Table Schema
**File Created**: `packages/db/src/schema/products/product-passport-versions.ts`

Created the `product_passport_versions` table with:
- `id`: UUID PRIMARY KEY
- `passport_id`: UUID NOT NULL FK → product_passports (NO CASCADE DELETE)
- `version_number`: INTEGER NOT NULL
- `data_snapshot`: JSONB NOT NULL - Complete DPP content as JSON-LD
- `content_hash`: VARCHAR NOT NULL - SHA-256 hash for integrity
- `schema_version`: VARCHAR NOT NULL - JSON schema version (e.g., "1.0")
- `published_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW()
- Unique constraint: (passport_id, version_number)

### Step 1.3: Modify Products Table Schema
**File Modified**: `packages/db/src/schema/products/products.ts`

Changes:
- Added `boolean` import from drizzle-orm/pg-core
- Added `hasUnpublishedChanges` column: BOOLEAN NOT NULL DEFAULT false
- Enhanced `status` field documentation to clarify only 'published' | 'unpublished' values

### Step 1.4: Export New Schemas
**File Modified**: `packages/db/src/schema/index.ts`

Added exports:
- `export * from "./products/product-passports";`
- `export * from "./products/dpp-versions";`

### Step 1.5: RLS Policies for New Tables
**Included in schema files** (using Drizzle's `pgPolicy` helper)

`product_passports` policies:
- SELECT for brand members via `is_brand_member(brand_id)`
- INSERT for brand members
- UPDATE for brand members
- DELETE for brand members
- SELECT for anonymous users (public) where `current_version_id IS NOT NULL`

`dpp_versions` policies:
- SELECT for brand members (via passport relationship)
- INSERT for brand members (via passport relationship)
- SELECT for anonymous users (public) where passport has current_version_id
- NO UPDATE or DELETE policies (versions are immutable)

### Validation
- `bun typecheck`: ✅ Passed (18 tasks successful)
- `bun lint`: ✅ Passed (15 tasks successful, no issues found)

### Notes
- RLS policies are defined using Drizzle's `pgPolicy` helper directly in the schema files, which is the modern approach. These will be included when migrations are generated.
- The user will need to run `bun run db:generate` to generate the migration and `bun run db:push` to apply it to the local database.
- The `current_version_id` column in `product_passports` doesn't have a formal FK to `dpp_versions` to avoid circular dependency issues. This relationship is enforced at the application level.

---

## Phase 2 - Query Layer - Publishing Logic
**Completed**: 2026-01-16T13:15:00+01:00

### Step 2.1: Create Passport CRUD Queries
**File Created**: `packages/db/src/queries/products/passports.ts`

Implemented:
- `generateUpid()` - Cryptographically random 16-char base62 UPID generation
- `createProductPassport(db, variantId, brandId)` - Creates passport with retry for UPID collisions
- `getPassportByUpid(db, upid)` - Fetches passport with current version data
- `getPassportByVariantId(db, variantId)` - Finds passport for a variant
- `getPassportsForProduct(db, productId)` - Gets all passports for product variants
- `updatePassportCurrentVersion(db, passportId, versionId)` - Updates after publishing
- `getOrCreatePassport(db, variantId, brandId)` - Main entry point for publish flow

### Step 2.2: Create DPP Version Queries
**File Created**: `packages/db/src/queries/products/dpp-versions.ts`

Implemented:
- `DppSnapshot` interface - Complete JSON-LD structure for version data
- `createDppVersion(db, passportId, dataSnapshot, schemaVersion)` - Creates immutable version
- `getLatestVersion(db, passportId)` - Gets current version for passport
- `getVersionById(db, versionId)` - Fetches specific version
- `getVersionByNumber(db, passportId, versionNumber)` - Historical version lookup
- `getVersionHistory(db, passportId)` - Full version timeline for audit UI
- `getVersionCount(db, passportId)` - Count of versions
- `verifyVersionIntegrity(db, versionId)` - SHA-256 hash verification

### Step 2.3: Create Snapshot Generation Logic
**File Created**: `packages/db/src/queries/products/snapshot.ts`

Implemented:
- `generateDppSnapshot(db, variantId, upid)` - Generates complete JSON-LD snapshot from working layer
- `wouldSnapshotDiffer(db, variantId, upid, currentSnapshot)` - Change detection

Data Collection:
- Core product/variant data
- Category name resolution
- Manufacturer details
- Variant attributes (name/value pairs)
- Weight (variant ?? product fallback)
- Environment data (carbon, water)
- Materials with full certification details
- Supply chain journey with facility data

### Step 2.4: Create Publish Action Query
**File Created**: `packages/db/src/queries/products/publish.ts`

Implemented:
- `publishVariant(db, variantId, brandId)` - Core publish operation
  1. Get or create passport
  2. Generate snapshot
  3. Create immutable version
  4. Update passport's current_version_id
  5. Update product status (published, no unpublished changes)
- `publishProduct(db, productId, brandId)` - Publishes all variants
- `bulkPublishProducts(db, productIds, brandId)` - Multiple product publish
- `hasPublishedVariants(db, productId)` - Check if any variant published
- `hasUnpublishedChanges(db, productId)` - Check for pending changes
- `getPublishingState(db, productId)` - Full publishing state

### Step 2.5: Update Product CRUD Queries
**File Modified**: `packages/db/src/queries/products/crud.ts`

Changes:
- `updateProduct()` now sets `hasUnpublishedChanges = true` and `updatedAt` on any content update
- Early return logic fixed to only trigger when no content fields changed

### Step 2.6: Create Public DPP Query V2
**File Created**: `packages/db/src/queries/dpp/public-v2.ts`

Implemented:
- `getPublicDppByUpid(db, upid)` - Main UPID-based lookup from publishing layer
- `getPublicDppVersion(db, upid, versionNumber)` - Historical version view
- `isPassportPublished(db, upid)` - Lightweight publish check

Features:
- Reads from snapshots (not normalized tables)
- Fetches brand theme for styling
- Handles inactive passports (variant deleted)
- New URL structure support: `passport.avelero.com/{upid}`

### Step 2.7: Export New Query Modules
**Files Modified**:
- `packages/db/src/queries/products/index.ts` - Added passports, dpp-versions, snapshot, publish exports
- `packages/db/src/queries/dpp/index.ts` - Added public-v2 export

### Validation
- `bun typecheck`: ✅ Passed (18 tasks successful)
- `bun lint`: ✅ Passed (15 tasks successful, no issues found)

### Notes
- Legacy `public.ts` is preserved for backward compatibility during transition
- New `public-v2.ts` provides UPID-based access to the publishing layer
- Snapshot generation collects all data with proper inheritance (variant ?? product)
- Version records are immutable - no UPDATE/DELETE operations provided
- Product status is updated to 'published' and hasUnpublishedChanges reset on publish

---

## Phase 3 - API Layer - Publishing Endpoints
**Completed**: 2026-01-16T13:45:00+01:00

### Step 3.1: Create Publish Router
**File Created**: `apps/api/src/trpc/routers/products/publish.ts`

Implemented tRPC endpoints for publishing:
- `publish.variant` - Publish a single variant
  - Input: `{ variantId: string }`
  - Creates/updates passport with new immutable version
  - Returns success status with passport and version info
- `publish.product` - Publish all variants of a product
  - Input: `{ productId: string }`
  - Publishes all variants in one operation
  - Returns count of published variants
- `publish.bulk` - Bulk publish multiple products
  - Input: `{ productIds: string[] }` (max 100)
  - Returns total counts for products and variants
- `publish.state` - Get publishing state for a product
  - Returns status, hasUnpublishedChanges, and variant info

### Step 3.2: Update Products Router
**File Modified**: `apps/api/src/trpc/routers/products/index.ts`

Changes:
- Added import for `publishRouter`
- Added `publish` sub-router to products router: `products.publish.*`

### Step 3.3: Update Variants Router
**File Modified**: `apps/api/src/trpc/routers/products/variants.ts`

Changes:
- Added import for `getPassportByVariantId` from db queries
- Enhanced `variants.get` endpoint with optional `includePassport` flag
- When `includePassport=true`, returns:
  - `passportUpid` - The passport's UPID for public URL
  - `isPublished` - Whether the variant has been published
  - `lastPublishedAt` - Timestamp of last publish
  - `firstPublishedAt` - Timestamp of first publish

### Step 3.4: Refactor Public DPP Router
**File Modified**: `apps/api/src/trpc/routers/dpp-public/index.ts`

Changes:
- Added import for `getPublicDppByUpid` from `@v1/db/queries/dpp`
- Added new `getByPassportUpid` endpoint for new URL structure: `/{upid}`
- This endpoint:
  - Reads from immutable publishing layer (snapshots)
  - Fetches passport by UPID from `product_passports`
  - Returns `data_snapshot` from current version in `dpp_versions`
  - Fetches and includes brand theme data
  - Handles inactive passports (variant deleted but snapshot preserved)
  - Resolves product image paths to public URLs

### Validation
- `bun typecheck`: ✅ Passed (18 tasks successful)
- `bun lint`: ✅ Passed (15 tasks successful, no issues found)

### Notes
- Legacy endpoints (`getByProductHandle`, `getByVariantUpid`) preserved for backward compatibility
- New `getByPassportUpid` provides simplified UPID-based access to published data
- Publish endpoints use existing db-layer functions from Phase 2
- Variant passport info is opt-in via `includePassport` flag to avoid N+1 queries

---

## Phase 6 - Public DPP App Refactoring
**Completed**: 2026-01-16T15:00:00+01:00

### Step 6.1: Update URL Routing
**File Created**: `apps/dpp/src/app/[upid]/page.tsx`

Created new UPID-based route for passport DPP pages:
- Fetches from immutable publishing layer (snapshots) via `dppPublic.getByPassportUpid`
- Validates UPID format (16-char alphanumeric)
- Includes `transformSnapshotToDppData` function to bridge snapshot structure to DppData format
- Handles inactive passports (variant deleted) with visual indicator
- Full theme support (custom fonts, stylesheets, Google Fonts)

**Files Modified**:
- `apps/dpp/src/app/[brand]/[productHandle]/page.tsx` - Added redirect to new UPID route
- `apps/dpp/src/app/[brand]/[productHandle]/[variantUpid]/page.tsx` - Added redirect to new UPID route

Legacy routes now:
1. Try to resolve passport UPID via `resolvePassportUpid` API call
2. If found, redirect to `/{upid}`
3. If not found, fallback to legacy working layer rendering (for unpublished products)

### Step 6.2: Update Data Fetching
**File Modified**: `apps/dpp/src/lib/api.ts`

Added new API functions:
- `fetchPassportDpp(upid)` - Fetches DPP data from immutable publishing layer
- `resolvePassportUpid(brandSlug, productHandle, variantUpid?)` - Resolves passport UPID from legacy URL params
- `PassportDppApiResponse` interface - Complete type for snapshot response

**File Modified**: `apps/dpp/src/lib/validation.ts`
- Added `validatePassportParams(upid)` function for UPID-only validation

### Step 6.3: API Layer Updates
**File Modified**: `apps/api/src/trpc/routers/dpp-public/index.ts`

Added new endpoint (Phase 3 already added `getByPassportUpid`):
- `resolvePassportUpid` - Resolves passport UPID from legacy URL parameters for redirects

**File Modified**: `packages/db/src/queries/dpp/public-v2.ts`

Added new query function:
- `resolvePassportUpidFromLegacy(db, brandSlug, productHandle, variantUpid?)` - Database query to find passport UPID from legacy URL params

### Step 6.4: Snapshot to DppData Transformation

Implemented `transformSnapshotToDppData` function in the new page component that bridges:
- JSON-LD snapshot structure (optimized for storage/immutability)
- DppData structure (optimized for component rendering)

Mapping includes:
- Product identifiers (UPID, SKU, barcode → articleNumber)
- Product attributes (name, description, image, category, manufacturer, attributes, weight)
- Environmental data (waterLiters, carbonKgCo2e → waterUsage, carbonEmissions)
- Materials composition with certifications
- Supply chain journey with operator details

### Validation
- `bun typecheck`: ✅ Passed (18 tasks successful)
- `bun lint`: ✅ Passed (15 tasks successful, no issues found)

### Notes
- New UPID-based route is the primary route for published passports: `/{upid}`
- Legacy routes (`/{brand}/{productHandle}/{variantUpid?}`) redirect to new structure when passport exists
- Unpublished products still accessible via legacy routes (no redirect)
- Inactive passports (variant deleted) show last published version with warning indicator
- Type assertions used for redirect to work around Next.js typed routes (dynamic route not yet generated)

---

## Phase 7 - Integration Updates
**Completed**: 2026-01-16T15:22:00+01:00

### Step 7.1: Update Sync Engine
**Files Modified**:
- `packages/db/src/queries/integrations/sync-batch-operations.ts`
- `packages/integrations/src/sync/engine.ts`

**Changes**:
1. `batchUpdateProducts` now sets `has_unpublished_changes = true` when updating products from integrations
2. Product creates during sync now include `hasUnpublishedChanges: true`

**Key Decision**: Integration syncs (Shopify, ERPs, etc.) mark products as having unpublished changes. Users must manually publish to make synced data visible on the public passport.

### Step 7.2: Update Import Jobs
**Files Modified**:
- `packages/jobs/src/trigger/bulk/validate-and-stage.ts`
- `packages/jobs/src/trigger/bulk/commit-to-production.ts`

**Changes**:
1. `VALID_STATUSES` constant updated to only include `['unpublished', 'published']` - removed 'archived' and 'scheduled' which are no longer used in the new publishing model
2. `PendingProductionOps.productCreates` interface updated to include `hasUnpublishedChanges: boolean`
3. `PendingProductionOps.productUpdates.data` interface updated to include `hasUnpublishedChanges: boolean`
4. Product creates during import now set `hasUnpublishedChanges: true`
5. Product updates during import now set `hasUnpublishedChanges: true`

**Key Decision**: Imported products require manual publishing. This ensures users explicitly verify and publish imported data before it becomes publicly visible.

### Step 7.3: Update Export Jobs
**Files Modified**:
- `packages/db/src/queries/products/export.ts`
- `packages/jobs/src/lib/excel.ts`
- `packages/jobs/__tests__/unit/excel-export/parent-child-rows.test.ts`

**Changes**:
1. `ExportProductData` interface updated to include:
   - `hasUnpublishedChanges: boolean`
   - `lastPublishedAt: string | null`
2. `getProductsForExport` query updated to:
   - Select `hasUnpublishedChanges` from products table
   - Load `lastPublishedAt` from product passports via new `loadLastPublishedForProducts` helper
3. `EXPORT_COLUMNS` array updated to include:
   - `"Has Unpublished Changes"` column
   - `"Last Published At"` column
4. `generateProductExportExcel` updated to write these new columns to exports
5. Test helper `createTestProduct` updated with new required fields

**Export Columns Added**:
- "Has Unpublished Changes" - Shows "Yes" or "No"
- "Last Published At" - ISO timestamp or empty if never published

### Validation
- `bun typecheck`: ✅ Passed (18 tasks successful)
- `bun lint`: ✅ Passed (15 tasks successful, no issues found)

### Notes
- All integration touchpoints now properly mark products as having unpublished changes
- The publishing workflow is now consistent: sync/import data → review → manually publish
- Export includes full publishing state for users to understand product status
- No auto-publishing occurs from syncs or imports; explicit user action required

---

## Phase 4 - UI Layer - Form Changes
**Completed**: 2026-01-16T16:00:00+01:00

### Step 4.1: Add Three-Dot Menu to Product Form
**File Modified**: `apps/app/src/components/forms/passport/product-form.tsx`

Added a three-dot menu (DropdownMenu) in the top right area of the product form header:
- Menu only appears in edit mode (not on create)
- Contains "Publish" action that publishes the product and all its variants
- Uses the existing `products.publish.product` tRPC endpoint
- Includes first publish warning modal integration

### Step 4.2: Update Form Actions Component
**File Modified**: `apps/app/src/components/forms/passport/actions.tsx`

Updated `ProductFormActions` component with:
- Kept existing Cancel and Save buttons
- Added Publish button on the right side (only shown when product exists)
- Publish button text logic:
  - "Publish" if status === 'unpublished' (never published)
  - "Publish changes" if status === 'published' (has been published before)
- Publish button disabled if:
  - No unpublished changes AND already published
  - Currently submitting or publishing
- Integrated first publish warning modal for first-time publishes

### Step 4.3: Create First Publish Warning Modal
**File Created**: `apps/app/src/components/modals/first-publish-modal.tsx`

Created modal warning users about attribute locking on first publish:
- Title: "Publishing your passport"
- Body: "Once published, you will no longer be able to add or remove attributes from this product. You can still edit individual variants and their attribute values."
- Checkbox: "Do not show this again"
- Buttons: [Cancel] [Publish]
- localStorage-based preference with 60-day expiry
- `shouldShowFirstPublishModal()` helper function exported for checking preference

### Step 4.4: Update Variant Block - Matrix Locking
**File Modified**: `apps/app/src/components/forms/passport/blocks/variant-block.tsx`

Added matrix locking behavior based on publishing status:
- Added `publishingStatus` prop to `VariantSection` component
- When product status === 'published':
  - Hides attribute selection area entirely (DnD context, attribute rows, add attribute button)
  - Shows only the header with "Add variant" button
  - Shows only the variants table
- When product status === 'unpublished':
  - Shows full matrix editing UI as before

### Supporting Changes

**File Modified**: `apps/app/src/contexts/passport-form-context.tsx`
- Added `productId`, `setProductId` to context
- Added `publishingStatus`, `setPublishingStatus` for tracking database publishing status
- Added `hasDbUnpublishedChanges`, `setHasDbUnpublishedChanges` for tracking database flag

**File Modified**: `apps/app/src/hooks/use-passport-form.ts`
- Added `dbPublishingStatus` and `dbHasUnpublishedChanges` state
- Syncs these values from loaded product data during hydration
- Exposes `productId`, `dbPublishingStatus`, `dbHasUnpublishedChanges` in return value

**File Modified**: `packages/db/src/queries/products/get.ts`
- Added `hasUnpublishedChanges` field to product data returned by `getProduct` and `getProductByHandle`

### Validation
- `bun typecheck`: ✅ Passed (18 tasks successful)
- `bun lint`: ✅ Passed (15 tasks successful, no issues found)

### Notes
- The three-dot menu provides an alternative "Publish" action at the top right, while the main Publish button remains in the form actions at the bottom
- Both publish entry points (three-dot menu and bottom button) integrate with the first publish warning modal
- The modal preference is stored in localStorage with a 60-day expiry
- Matrix locking prevents users from adding/removing attributes after first publish, maintaining data integrity for published passports

---

## Phase 8 - Final Cleanup and Validation
**Completed**: 2026-01-16T17:00:00+01:00

### Step 8.1: Remove Deprecated Status Values
**Files Modified**:
- `apps/app/src/config/filters.ts`: Removed 'scheduled' and 'archived' from STATUS_OPTIONS
- `apps/app/src/components/forms/passport/sidebars/status-sidebar.tsx`: Removed 'archived' and 'scheduled' options
- `apps/app/src/hooks/use-passport-form.ts`: Updated status type cast to only include 'published' | 'unpublished'
- `apps/app/src/components/forms/passport/variant-form.tsx`: Simplified productStatus mapping (removed 'archived' handling)
- `packages/db/src/queries/integrations/promotion.ts`:
  - Updated `archiveEmptyProducts` to use 'unpublished' instead of 'archived'
  - Updated `createProductForPromotion` to use 'unpublished' instead of 'draft'
- `packages/integrations/__tests__/integration/promotion/basic.test.ts`: Updated test to expect 'unpublished' status
- `packages/integrations/__tests__/integration/promotion/regrouping.test.ts`: Refactored test to check for products without variants directly

### Step 8.2: Update Type Definitions
Type definitions were already in place from previous phases:
- ProductPassport and DppVersion schemas exist in `packages/db/src/schema/products/`
- Product status type is correctly defined as 'published' | 'unpublished' in the products schema
- No additional type updates required

### Step 8.3: Add Schema Version Constant
**Files Created**:
- `packages/db/src/constants/dpp-schema.ts`: Defines `DPP_SCHEMA_VERSION = "1.0"`
- `packages/db/src/constants/index.ts`: Re-exports all constants

**File Modified**:
- `packages/db/src/index.ts`: Added export for constants module

### Step 8.4: Final Lint and Typecheck
- `bun typecheck`: ✅ Passed (18 tasks successful)
- `bun lint`: ✅ Passed (15 tasks successful, no issues found)

### Notes
- Product status is now strictly 'published' | 'unpublished' throughout the codebase
- The 'archived' status behavior (for products with no variants) now uses 'unpublished' status
- The DPP schema version constant enables future schema migrations
- All test files have been updated to reflect the new status values

---

## Implementation Summary

All 8 phases of the Immutable Passports implementation have been completed:

1. **Phase 1 (Schema)**: Created product_passports and product_passport_versions tables with JSON-LD snapshot storage
2. **Phase 2 (Database Operations)**: Implemented snapshot creation, publishing logic, and DPP version management
3. **Phase 3 (API Layer)**: Created tRPC endpoints for publishing products/variants and updated DPP public endpoints
4. **Phase 4 (UI - Form Changes)**: Added Publish button, first publish warning modal, and matrix locking
5. **Phase 5 (Skipped)**: UI list changes were not required as the existing table structure handles status display
6. **Phase 6 (DPP App)**: Updated public passport pages to use versioned data from product_passport_versions
7. **Phase 7 (Integration Touchpoints)**: Updated sync engine, import jobs, and export to respect publishing workflow
8. **Phase 8 (Cleanup)**: Removed deprecated status values, added schema version constant, final validation

### Key Architectural Changes
- Passports are now immutable once published (attribute matrix locked)
- All published data is stored as JSON-LD snapshots for long-term stability
- Integration syncs/imports mark products as having unpublished changes (no auto-publish)
- Status simplified to: 'unpublished' (draft/never published) and 'published' (has been published)
- UPID-based routing enables direct access to specific variants via their unique identifiers

