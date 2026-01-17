# Immutable Passports Implementation Phases

This document provides a detailed, phased implementation plan for the Immutable Passports feature. Each phase contains specific, actionable steps that should be completed in order.

---

## Instructions for Executing LLM Agents

### General Guidelines

1. **Progress Tracking**: After completing each step or phase, append a progress update to `immutable-passports-progress.md`. Include:
   - Date/timestamp
   - Phase and step completed
   - Brief summary of changes made
   - Any issues encountered and how they were resolved

2. **Validation After Every Change**: After completing each step, run:
   ```bash
   bun lint
   bun typecheck
   ```
   Fix any errors before proceeding to the next step.

3. **No Browser/Dev Server**: Do NOT run `bun test`, `bun run dev`, or spin up any dev server. Do NOT use browser automation.

4. **Database Migrations**:
   - **Schema changes** (new tables, columns, relations): Modify files in `packages/db/src/schema/` directory. The user will run Drizzle-Kit commands manually:
     - `bun run db:generate` - Generate migration
     - `bun run db:push` - Apply to local database
   - **RLS policies, functions, triggers, storage buckets**: Use `supabase migration new <name>` CLI to generate an empty timestamped migration file, then populate it with SQL.
   - NEVER manually create migration files with arbitrary timestamps.

5. **File References**: Use absolute paths when referencing files.

---

## Phase 0: Project Setup and Preparation

### Step 0.1: Remove Eco Claims - Database Schema

**Goal**: Remove eco claims tables from the schema as they are no longer used.

**Files to modify**:
- Delete: `packages/db/src/schema/catalog/brand-eco-claims.ts`
- Delete: `packages/db/src/schema/products/product-eco-claims.ts`
- Delete: `packages/db/src/schema/products/variant-eco-claims.ts` (if exists)
- Modify: `packages/db/src/schema/index.ts` - Remove all eco claims exports

**Actions**:
1. Delete the eco claims schema files
2. Remove all imports and exports of eco claims from `packages/db/src/schema/index.ts`
3. Search for any other files importing eco claims schemas and remove those imports

---

### Step 0.2: Remove Eco Claims - Query Layer

**Goal**: Remove eco claims from all database queries.

**Files to modify**:
- `packages/db/src/queries/products/crud.ts`
- `packages/db/src/queries/products/get.ts`
- `packages/db/src/queries/products/variants.ts`
- `packages/db/src/queries/dpp/public.ts`
- `packages/db/src/queries/dpp/transform.ts`

**Actions**:
1. Search for `eco_claim` or `ecoClaim` in the queries directory
2. Remove all eco claims-related query logic, joins, and inserts
3. Remove eco claims from any return types or data transformations

---

### Step 0.3: Remove Eco Claims - API Layer

**Goal**: Remove eco claims from all tRPC routers and input schemas.

**Files to modify**:
- `apps/api/src/trpc/routers/products/index.ts`
- `apps/api/src/trpc/routers/products/variants.ts`
- `apps/api/src/trpc/routers/catalog/` (any eco claims router)
- `apps/api/src/schemas/` (any eco claims schemas)

**Actions**:
1. Search for `eco` in the API app
2. Remove eco claims from router endpoints
3. Remove eco claims from input/output schemas
4. Remove any dedicated eco claims router file

---

### Step 0.4: Remove Eco Claims - UI Layer

**Goal**: Remove eco claims from all dashboard forms and components.

**Files to modify**:
- `apps/app/src/components/forms/passport/blocks/` - Remove eco claims block
- `apps/app/src/components/forms/passport/product-form.tsx`
- `apps/app/src/components/forms/passport/variant-form.tsx`
- Any hooks that reference eco claims

**Actions**:
1. Delete the eco claims block component if it exists as a separate file
2. Remove eco claims section from product and variant forms
3. Remove eco claims from form state/hooks

---

### Step 0.5: Remove Eco Claims - Import/Export

**Goal**: Remove eco claims from bulk import and export functionality.

**Files to modify**:
- `packages/jobs/src/trigger/bulk/export-products.ts`
- `packages/jobs/src/trigger/bulk/import-products.ts`
- `packages/jobs/src/trigger/bulk/validate-and-stage.ts`

**Actions**:
1. Search for `eco` in the jobs package
2. Remove eco claims columns from Excel template handling
3. Remove eco claims from import validation and staging logic
4. Remove eco claims from export data assembly

---

### Step 0.6: Disable Product Carousel

**Goal**: Add feature flag and disable product carousel throughout the application.

**Files to create/modify**:
- Add environment variable `FEATURE_PRODUCT_CAROUSEL_ENABLED=false` to `.env.example` files
- `apps/dpp/src/` - Conditionally render carousel based on flag
- `packages/db/src/queries/dpp/carousel.ts` - Add early return when disabled
- Theme editor components (if they exist)

**Actions**:
1. Add `FEATURE_PRODUCT_CAROUSEL_ENABLED` environment variable with default `false`
2. Add conditional checks in carousel-related components
3. Skip carousel data fetching when disabled
4. Hide carousel configuration in theme editor when disabled
5. Do NOT delete any carousel code - only disable via feature flag

---

## Phase 1: Database Schema - Publishing Layer

### Step 1.1: Create Product Passports Table Schema

**Goal**: Create the `product_passports` table schema for the immutable publishing layer.

**File to create**: `packages/db/src/schema/products/product-passports.ts`

**Schema definition**:
```typescript
// product_passports table
// Columns:
// - id: UUID PRIMARY KEY
// - upid: VARCHAR(24) UNIQUE NOT NULL - Universal Product Identifier for public URLs
// - brand_id: UUID NOT NULL FK → brands (NO CASCADE DELETE)
// - working_variant_id: UUID FK → product_variants ON DELETE SET NULL
// - current_version_id: UUID FK → dpp_versions (nullable, set after first publish)
// - first_published_at: TIMESTAMPTZ NOT NULL
// - last_published_at: TIMESTAMPTZ NOT NULL
// - created_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
// - updated_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**Critical**: 
- `brand_id` must NOT have cascade delete - passports persist even if brand is deleted
- `working_variant_id` uses `ON DELETE SET NULL` - link severed when variant deleted

---

### Step 1.2: Create DPP Versions Table Schema

**Goal**: Create the `dpp_versions` table schema for immutable version history.

**File to create**: `packages/db/src/schema/products/dpp-versions.ts`

**Schema definition**:
```typescript
// dpp_versions table
// Columns:
// - id: UUID PRIMARY KEY
// - passport_id: UUID NOT NULL FK → product_passports (NO CASCADE DELETE)
// - version_number: INTEGER NOT NULL
// - data_snapshot: JSONB NOT NULL - Complete DPP content as JSON-LD
// - content_hash: VARCHAR(64) NOT NULL - SHA-256 hash for integrity
// - schema_version: VARCHAR(10) NOT NULL - JSON schema version (e.g., "1.0")
// - published_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
//
// Unique constraint: (passport_id, version_number)
```

**Critical**: No cascade deletes - versions are immutable and permanent.

---

### Step 1.3: Modify Products Table Schema

**Goal**: Update the `products` table with publishing state columns.

**File to modify**: `packages/db/src/schema/products/products.ts`

**Changes**:
1. Modify `status` column to only allow `'published'` | `'unpublished'` (remove `'archived'`, `'scheduled'`)
2. Add `has_unpublished_changes` column: BOOLEAN NOT NULL DEFAULT false

**Actions**:
1. Update the status enum/type to only include two values
2. Add the new boolean column
3. Update any default values appropriately

---

### Step 1.4: Export New Schemas

**Goal**: Export the new tables from the schema index.

**File to modify**: `packages/db/src/schema/index.ts`

**Actions**:
1. Import `productPassports` from `./products/product-passports`
2. Import `dppVersions` from `./products/dpp-versions`
3. Export both tables
4. Add any necessary relations configurations

---

### Step 1.5: Create RLS Policies for New Tables

**Goal**: Set up Row Level Security policies for the publishing layer tables.

**Actions**:
1. Run `supabase migration new add_product_passports_rls` to create migration file
2. Add RLS policies for `product_passports`:
   - SELECT: Brand members can read their brand's passports
   - INSERT: Brand members can create passports for their brand
   - UPDATE: Brand members can update their brand's passports
   - DELETE: Brand members can delete (sever link, but record persists)
3. Add RLS policies for `dpp_versions`:
   - SELECT: Brand members can read their passport versions
   - INSERT: Brand members can create versions
   - No UPDATE or DELETE - versions are immutable
4. Add public read policy for `dpp_versions` (public passports are readable by anyone)

---

## Phase 2: Query Layer - Publishing Logic

### Step 2.1: Create Passport CRUD Queries

**Goal**: Create database queries for managing product passports.

**File to create**: `packages/db/src/queries/products/passports.ts`

**Functions to implement**:
```typescript
// createProductPassport(variantId, brandId) 
// - Generate UPID
// - Create product_passports record
// - Return the created passport

// getPassportByUpid(upid)
// - Fetch passport with current version data

// getPassportByVariantId(variantId)
// - Check if a variant already has a passport

// updatePassportCurrentVersion(passportId, versionId)
// - Update current_version_id and last_published_at
```

---

### Step 2.2: Create DPP Version Queries

**Goal**: Create database queries for managing DPP versions.

**File to create**: `packages/db/src/queries/products/dpp-versions.ts`

**Functions to implement**:
```typescript
// createDppVersion(passportId, dataSnapshot, schemaVersion)
// - Calculate version_number (max + 1 for passport)
// - Calculate content_hash (SHA-256 of canonical JSON)
// - Insert dpp_versions record
// - Return the created version

// getLatestVersion(passportId)
// - Get the current/latest version for a passport

// getVersionHistory(passportId)
// - Get all versions for a passport (for future audit UI)
```

---

### Step 2.3: Create Snapshot Generation Logic

**Goal**: Create the logic to generate JSON-LD snapshots from working layer data.

**File to create**: `packages/db/src/queries/products/snapshot.ts`

**Functions to implement**:
```typescript
// generateDppSnapshot(variantId, productId)
// - Fetch all working layer data for the variant/product
// - Transform into JSON-LD structure per the plan
// - Include: productIdentifiers, productAttributes, environmental, materials, supplyChain, metadata
// - Return the complete JSON-LD object

// The structure should match the example in immutable-passports-plan.md Section 3
```

**Key considerations**:
- Fetch product data, variant data, materials, journey steps, environment data
- Resolve variant overrides (variant data takes precedence over product data)
- Flatten all nested IDs into actual data (manufacturer details, facility details, etc.)
- Use schema version "1.0" for initial implementation

---

### Step 2.4: Create Publish Action Query

**Goal**: Create the main publish action that orchestrates the entire publish flow.

**File to create**: `packages/db/src/queries/products/publish.ts`

**Functions to implement**:
```typescript
// publishVariant(variantId, brandId)
// 1. Check if passport exists for variant, create if not
// 2. Generate snapshot from current working data
// 3. Create new dpp_version record
// 4. Update passport's current_version_id and last_published_at
// 5. Update product's has_unpublished_changes = false, status = 'published'
// 6. If first publish, set first_published_at on passport
// 7. Return success with passport and version info

// publishProduct(productId, brandId)
// - Publish all variants of a product
// - Wrap in transaction
```

---

### Step 2.5: Update Product CRUD Queries

**Goal**: Update existing product queries to set `has_unpublished_changes` flag.

**File to modify**: `packages/db/src/queries/products/crud.ts`

**Changes**:
1. On every product update, set `has_unpublished_changes = true`
2. On variant updates, set the parent product's `has_unpublished_changes = true`
3. Remove any references to 'archived' or 'scheduled' status values

---

### Step 2.6: Refactor Public DPP Query

**Goal**: Refactor the public DPP query to read from snapshots instead of normalized tables.

**File to modify**: `packages/db/src/queries/dpp/public.ts`

**Changes**:
1. Remove complex joins across normalized tables for content
2. Fetch passport by UPID
3. Get current version's `data_snapshot`
4. Keep theme data fetching unchanged (brand-level styling)
5. Return snapshot data + theme data
6. Handle case where passport exists but working_variant_id is NULL (deleted variant - show last version with "inactive" indicator)

---

## Phase 3: API Layer - Publishing Endpoints

### Step 3.1: Create Publish Router

**Goal**: Create tRPC router endpoints for publishing functionality.

**File to create**: `apps/api/src/trpc/routers/products/publish.ts`

**Endpoints to implement**:
```typescript
// publish.variant
// - Input: { variantId: string }
// - Calls publishVariant query
// - Returns: { success: boolean, passport: {...}, version: {...} }

// publish.product
// - Input: { productId: string }
// - Publishes all variants of the product
// - Returns: { success: boolean, count: number }

// publish.bulk
// - Input: { productIds: string[] }
// - Publishes all variants of all selected products
// - Returns: { success: boolean, count: number }
```

---

### Step 3.2: Update Products Router

**Goal**: Update the products router to include publishing state in responses.

**File to modify**: `apps/api/src/trpc/routers/products/index.ts`

**Changes**:
1. Include `has_unpublished_changes` and `status` in product responses
2. Include `last_published_at` for listing pages
3. Remove 'archived' and 'scheduled' from status filter options
4. Add the publish router to the products router

---

### Step 3.3: Update Variants Router

**Goal**: Update the variants router to support passport/UPID data.

**File to modify**: `apps/api/src/trpc/routers/products/variants.ts`

**Changes**:
1. Return passport UPID if variant has been published
2. Include publishing status info in variant responses
3. Ensure variant updates trigger `has_unpublished_changes = true` on parent product

---

### Step 3.4: Refactor Public DPP Router

**Goal**: Refactor the public DPP router to use new URL structure.

**File to modify**: `apps/api/src/trpc/routers/dpp-public/` (or wherever public routes are)

**Changes**:
1. Change route from `/{brandSlug}/{productHandle}/{upid?}` to just `/{upid}`
2. Fetch from `product_passports` and `dpp_versions` instead of working layer
3. Remove product handle and brand slug resolution
4. Simplify to single UPID-based lookup

---

## Phase 4: UI Layer - Form Changes

### Step 4.1: Add Three-Dot Menu to Product Form

**Goal**: Add a three-dot menu on the top right of the product form with a "Publish" action.

**File to modify**: `apps/app/src/components/forms/passport/product-form.tsx`

**Changes**:
1. Add a three-dot menu (DropdownMenu) in the top right area of the form header
2. Menu contains:
   - "Publish" action — publishes the product and all its variants
3. The menu should only appear on the product edit form, NOT on create

**Note**: Do NOT add this three-dot menu to the variant editing page.

---

### Step 4.2: Update Form Actions Component

**Goal**: Keep existing Back/Save button pattern, add Publish button.

**File to modify**: `apps/app/src/components/forms/passport/actions.tsx`

**Changes**:
1. Keep existing `Back` and `Save` buttons
2. Add `Publish` or `Publish changes` button on the right side
3. Publish button text logic:
   - "Publish" if status === 'unpublished'
   - "Publish changes" if status === 'published'
4. Publish button disabled if no unpublished changes and already published

**Note**: The three-dot menu provides an alternative "Publish" action at the top right, while the main Publish button remains in the form actions at the bottom.

---

### Step 4.3: Create First Publish Warning Modal

**Goal**: Create modal warning users about attribute locking on first publish.

**File to create**: `apps/app/src/components/modals/first-publish-modal.tsx`

**Content**:
```
Title: "Publishing your passport"
Body: "Once published, you will no longer be able to add or remove attributes from this product. You can still edit individual variants and their attribute values."
Checkbox: "Do not show this again"
Buttons: [Cancel] [Publish]
```

**Cookie logic**:
- Store preference in cookie with 60-day expiry
- Check cookie before showing modal
- If checkbox checked, set cookie on confirm

---

### Step 4.4: Update Variant Block - Matrix Locking

**Goal**: Lock the variant matrix after first publish.

**File to modify**: `apps/app/src/components/forms/passport/blocks/variant-block.tsx`

**Changes**:
1. If product status === 'published':
   - Hide attribute selection area entirely
   - Show only variants table and "Add variant" button
2. If product status === 'unpublished':
   - Show full matrix editing UI as currently exists
3. For new/unsaved variants, show "new" chip (exception to auto-save, because adding new attributes means new varants will be created, which is off for auto-save. We should think of another approach here.)
4. For saved variants, make rows clickable

---

## Phase 5: UI Layer - Passports List Page

### Step 5.1: Update Metrics Cards

**Goal**: Replace current metrics with new publishing-aware metrics.

**File to modify**: `apps/app/src/components/passports/data-section.tsx` (or similar)

**New metrics**:
1. Total Passports - count of all products
2. Published - count where status = 'published'
3. Unpublished - count where status = 'unpublished'
4. Pending Changes - count where status = 'published' AND has_unpublished_changes = true

---

### Step 5.2: Update Table Columns

**Goal**: Add "Last Published At" column and simplify status column.

**File to modify**: `apps/app/src/components/tables/passports/columns.tsx` (or similar)

**Changes**:
1. Add "Last Published At" column with formatted date
2. Simplify Status column to only show "Published" or "Unpublished"
3. Remove any "Archived" or "Scheduled" status displays

---

### Step 5.3: Update Table Row Click Behavior

**Goal**: Navigate to first variant's UPID when clicking a row.

**File to modify**: `apps/app/src/components/tables/passports/columns.tsx`

**Changes**:
1. Fetch first variant's UPID for each product
2. On 'Passports' button click, navigate to `passports.avelero.com/[upid]`

---

### Step 5.4: Update Bulk Actions

**Goal**: Replace status change bulk action with Publish bulk action.

**File to modify**: Bulk actions component for passports table

**Changes**:
1. Remove "Change Status" bulk action with submenu
2. Keep "Delete" bulk action
3. Add "Publish" bulk action
4. Publish action calls `publish.bulk` endpoint

---

### Step 5.5: Update Row-Level Actions

**Goal**: Update three-dot menu for each passport row.

**File to modify**: Table row actions component

**Changes**:
1. Remove status change options (Archive, etc.)
2. Keep "Delete" option
3. Add "Publish" option
   - Disabled/muted if already published with no unpublished changes
   - Enabled if unpublished OR has_unpublished_changes = true

---

### Step 5.6: Create Delete Confirmation Modal

**Goal**: Create modal for deleting published passports.

**File to create**: `apps/app/src/components/modals/delete-passport-modal.tsx`

**Content for single variant**:
```
Title: "Delete variant"
Body: "This will make the QR code inactive. You won't be able to edit this variant from your dashboard anymore. Are you sure you want to proceed?"
Buttons: [Cancel] [Delete variant]
```

**Content for product**:
```
Title: "Delete product"
Body: "This will make the QR codes for all [X] variants inactive. You won't be able to edit them from your dashboard anymore. Are you sure you want to proceed?"
Buttons: [Cancel] [Delete product]
```

---

## Phase 6: Public DPP App Refactoring

### Step 6.1: Update URL Routing

**Goal**: Change from `/{brand}/{handle}/{upid}` to just `/{upid}`.

**Files to modify**:
- `apps/dpp/src/app/[brand]/[productHandle]/page.tsx` - Remove or redirect
- `apps/dpp/src/app/[brand]/[productHandle]/[variantUpid]/page.tsx` - Remove or redirect
- Create new: `apps/dpp/src/app/[upid]/page.tsx`

**Actions**:
1. Create new route `apps/dpp/src/app/[upid]/page.tsx`
2. Move/refactor rendering logic to new route
3. Keep old routes but redirect to new UPID-based URL
4. Update any internal links to use new URL structure

---

### Step 6.2: Update Data Fetching

**Goal**: Fetch from snapshots instead of normalized tables.

**File to modify**: `apps/dpp/src/lib/api.ts` (or data fetching utilities)

**Changes**:
1. Fetch passport by UPID from `product_passports`
2. Get `data_snapshot` from current version in `dpp_versions`
3. Still fetch theme data from `brand_theme` (brand-level)
4. Handle case where passport exists but variant was deleted (show inactive state)

---

### Step 6.3: Update DPP Rendering Components

**Goal**: Update components to consume JSON-LD snapshot structure.

**Files to modify**:
- `packages/dpp-components/src/` - All rendering components
- Any components expecting normalized data structure

**Changes**:
1. Update component props to match JSON-LD structure
2. Update type definitions in `packages/dpp-components/src/types.ts`
3. Ensure all sections render from snapshot data:
   - Product identifiers (UPID, SKU, barcode)
   - Product attributes (name, description, image, category, manufacturer, attributes, weight)
   - Environmental data
   - Materials composition
   - Supply chain journey

---

## Phase 7: Integration Updates

### Step 7.1: Update Sync Engine

**Goal**: Ensure integration syncs set has_unpublished_changes flag.

**File to modify**: `packages/integrations/src/sync/engine.ts`

**Changes**:
1. After syncing product data, set `has_unpublished_changes = true`
2. This applies to any field updates from Shopify, ERPs, etc.
3. Do NOT auto-publish - require manual publish action

---

### Step 7.2: Update Import Jobs

**Goal**: Update bulk import to work with new publishing model.

**Files to modify**:
- `packages/jobs/src/trigger/bulk/import-products.ts`
- `packages/jobs/src/trigger/bulk/validate-and-stage.ts`
- `packages/jobs/src/trigger/bulk/commit-to-production.ts`

**Changes**:
1. Imported products start with status = 'unpublished'
2. has_unpublished_changes = true after import
3. Remove any eco claims handling (done in Phase 0)
4. No auto-publishing - user must manually publish after import

---

### Step 7.3: Update Export Jobs

**Goal**: Update bulk export to include publishing state data.

**File to modify**: `packages/jobs/src/trigger/bulk/export-products.ts`

**Changes**:
1. Include `status` and `has_unpublished_changes` columns (do not include in export, not relevant for user)
2. Include `last_published_at` column if passport exists (do not include in export, not relevant for user)
3. Remove eco claims columns (done in Phase 0)

---

## Phase 8: Final Cleanup and Validation

### Step 8.1: Remove Deprecated Status Values

**Goal**: Clean up any remaining references to 'archived' or 'scheduled' status.

**Actions**:
1. Search entire codebase for 'archived' status references
2. Search entire codebase for 'scheduled' status references
3. Remove or update all found references
4. Update any status filter dropdowns/selects

---

### Step 8.2: Update Type Definitions

**Goal**: Ensure all TypeScript types are updated consistently.

**Files to check**:
- `packages/db/src/types/` - Any type definition files
- `apps/app/src/types/` - Frontend type definitions
- `apps/api/src/schemas/` - API input/output schemas

**Actions**:
1. Product status type: only 'published' | 'unpublished'
2. Add ProductPassport and DppVersion types
3. Remove EcoClaim types from all files
4. Add snapshot JSON-LD type definition

---

### Step 8.3: Add Schema Version Constant

**Goal**: Define the initial DPP schema version constant.

**File to create**: `packages/db/src/constants/dpp-schema.ts`

**Content**:
```typescript
export const DPP_SCHEMA_VERSION = "1.0";
// Update this when the snapshot structure changes
```

---

### Step 8.4: Final Lint and Typecheck

**Goal**: Ensure entire codebase passes lint and typecheck.

**Actions**:
1. Run `bun lint` from repo root
2. Run `bun typecheck` from repo root
3. Fix any remaining errors
4. Commit all changes

---

## Appendix A: File Reference Summary

### New Files to Create
- `packages/db/src/schema/products/product-passports.ts`
- `packages/db/src/schema/products/dpp-versions.ts`
- `packages/db/src/queries/products/passports.ts`
- `packages/db/src/queries/products/dpp-versions.ts`
- `packages/db/src/queries/products/snapshot.ts`
- `packages/db/src/queries/products/publish.ts`
- `packages/db/src/constants/dpp-schema.ts`
- `apps/api/src/trpc/routers/products/publish.ts`
- `apps/app/src/components/modals/first-publish-modal.tsx`
- `apps/app/src/components/modals/delete-passport-modal.tsx`
- `apps/dpp/src/app/[upid]/page.tsx`

### Files to Delete
- `packages/db/src/schema/catalog/brand-eco-claims.ts`
- `packages/db/src/schema/products/product-eco-claims.ts`
- `packages/db/src/schema/products/variant-eco-claims.ts` (if exists)

### Key Files to Modify
- `packages/db/src/schema/products/products.ts`
- `packages/db/src/schema/index.ts`
- `packages/db/src/queries/products/crud.ts`
- `packages/db/src/queries/dpp/public.ts`
- `apps/api/src/trpc/routers/products/index.ts`
- `apps/api/src/trpc/routers/products/variants.ts`
- `apps/app/src/components/forms/passport/product-form.tsx`
- `apps/app/src/components/forms/passport/variant-form.tsx`
- `apps/app/src/components/forms/passport/actions.tsx`
- `apps/app/src/components/forms/passport/blocks/variant-block.tsx`
- `apps/app/src/components/passports/table-section.tsx`
- `apps/app/src/components/passports/data-section.tsx`
- `packages/integrations/src/sync/engine.ts`
- `packages/jobs/src/trigger/bulk/*.ts`

---

## Appendix B: Progress Tracking Template

After each step, append to `immutable-passports-progress.md`:

```markdown
## Phase X - Step X.X: [Step Name]
**Completed**: [Date/Time]

### Changes Made
- [File]: [Brief description of change]
- [File]: [Brief description of change]

### Validation
- `bun lint`: ✅ Passed / ❌ Fixed [N] errors
- `bun typecheck`: ✅ Passed / ❌ Fixed [N] errors

### Notes
[Any issues encountered, decisions made, or deviations from plan]

---
```
