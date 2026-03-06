# Publishing Refactor Plan

## Table of Contents

1. [Current System Overview](#1-current-system-overview)
2. [Current File Tree](#2-current-file-tree)
3. [Problems With the Current System](#3-problems-with-the-current-system)
4. [Desired System Overview](#4-desired-system-overview)
5. [File Tree After Implementation](#5-file-tree-after-implementation)
6. [Per-File Change Specification](#6-per-file-change-specification)
7. [Implementation Phases](#7-implementation-phases)
8. [Edge Cases and Test Cases](#8-edge-cases-and-test-cases)

---

## 1. Current System Overview

### Data Model

The publishing system has four layers:

**products** (`products.status`) is the user-facing publication switch. When a user clicks "Publish" or "Unpublish," this status column is what changes. It applies to all variants under the product. Values: `published`, `unpublished`, `scheduled` (scheduled is visual-only and behaves like unpublished).

**product_variants** is the publishable unit. Each variant carries a UPID (Universal Product Identifier) and optional overrides for name, description, and image. Variant-level data (materials, environment, weight, journey) falls back to product-level data when not present.

**product_passports** is the durable identity record for the public-facing passport. It is keyed by UPID and carries a `currentVersionId` pointer to the latest published snapshot. It also tracks lifecycle state (`active` vs `orphaned`). Despite the original design intent that this record would only be created on first publish, the code already creates passports on variant creation, bulk import, and integration sync.

**product_passport_versions** is the immutable audit log. Each row contains a complete JSONB snapshot (`data_snapshot`) of all passport data at the moment of publishing. Versions are append-only and never updated or deleted. The public passport URL serves whatever snapshot is pointed to by `product_passports.current_version_id`.

### Snapshot Generation

The snapshot is a self-contained JSON-LD object assembled from 7+ tables: product core data, variant overrides, category, manufacturer, attributes, weight, environment, materials (with certifications), and supply chain journey steps (with operator details). For a single variant, this runs 7 parallel queries. For batch operations, a set-based prefetch loads all data for up to 500 variants at once.

Content-hash deduplication (SHA-256 of canonical JSON) prevents duplicate versions when the underlying data hasn't actually changed.

### Publishing Triggers

There are currently four distinct code paths that trigger snapshot generation:

1. **Explicit publish from UI**: User saves product form with status="published", or calls the publish endpoint directly. The UI form hook (`use-passport-form.ts`) explicitly calls publish after save.
2. **Bulk status change**: User selects multiple products and sets status to "published". This fire-and-forgets `bulkPublishProducts()`, which loops product-by-product (does NOT use the set-based publisher).
3. **Catalog fan-out**: When a manufacturer, material, certification, or operator is edited, a background job fires after a 45-second delay and republishes all affected published products using `publishProductsSetBased()`. The 45-second delay existed to debounce rapid edits before running the expensive snapshot generation.
4. **Bulk import commit**: The commit-to-production job processes imported products in batches of 250 and calls `publishProductsSetBased()`.

### Public Read Path

When a customer scans a QR code, the URL resolves to `passport.avelero.com/{upid}`. The `getByPassportUpid()` function fetches the passport record, retrieves the snapshot from the version pointed to by `currentVersionId`, and returns it along with brand theme data. This reads exclusively from the immutable publishing layer.

### Cache Revalidation

After any publish operation, cache tags are invalidated via POST to the DPP app's `/api/revalidate` endpoint. Tags follow the pattern `dpp-passport-{upid}` and `dpp-barcode-{brandId}-{barcode}`. Revalidation is fire-and-forget and chunked (100 tags per request).

---

## 2. Current File Tree

```
packages/db/src/schema/products/
├── products.ts                    # Product table (status column = publication switch)
├── product-variants.ts            # Variant table (UPIDs, overrides)
├── product-passports.ts           # Passport identity table (currentVersionId pointer)
└── product-passport-versions.ts   # Immutable version history (JSONB snapshots)

packages/db/src/queries/products/
├── publish.ts                     # Single variant/product/bulk publish logic
├── publish-batch.ts               # Set-based batch publish (chunks of 500)
├── snapshot.ts                    # Single-variant snapshot generation (7 parallel queries)
├── passports.ts                   # Passport CRUD (create, orphan, sync metadata, batch create)
├── dpp-versions.ts                # Version creation + DppSnapshot type definition
└── catalog-fan-out.ts             # Resolvers: find published products by manufacturer/material/cert/operator

packages/db/src/queries/dpp/
└── public.ts                      # Public read path (getPublicDppByUpid, getPublicDppVersion)

apps/api/src/trpc/routers/products/
├── index.ts                       # Products router (update mutation triggers inline publish)
├── publish.ts                     # Publish router (variant/product/bulk/state endpoints)
└── variants.ts                    # Variants router (sync mutation, syncPassportMetadata)

apps/api/src/trpc/routers/catalog/
└── index.ts                       # Catalog router (enqueueCatalogFanOut after entity CRUD)

apps/api/src/trpc/routers/dpp-public/
└── index.ts                       # Public DPP router (getByPassportUpid, getByBarcode)

apps/api/src/lib/
└── dpp-revalidation.ts            # API-side cache revalidation (revalidatePassports, etc.)

packages/jobs/src/trigger/catalog/
└── fan-out.ts                     # Background job: resolve affected products, republish, revalidate

packages/jobs/src/trigger/bulk/
└── commit-to-production.ts        # Background job: bulk import commit, calls publishProductsSetBased

packages/jobs/src/trigger/integrations/
└── sync.ts                        # Background job: integration sync (does NOT republish existing)

packages/jobs/src/lib/
└── dpp-revalidation.ts            # Job-side cache revalidation

apps/app/src/hooks/
└── use-passport-form.ts           # UI form hook (calls publish explicitly after save)

apps/app/src/components/forms/passport/
└── variant-form.tsx               # Variant form component (calls publishVariant after save)
```

---

## 3. Problems With the Current System

### 3.1 Snapshot generation is eagerly coupled to every mutation

Every publish action (whether triggered by a user save, bulk status change, or catalog fan-out) immediately runs the full snapshot generation pipeline across all affected variants. For a brand with 50k published variants, a single manufacturer name change triggers 50k snapshot computations. If three catalog edits happen within an hour, that's 150k computations.

### 3.2 Publishing is scattered across multiple code paths

Four different routers/jobs independently call publish functions: the products router (inline for single, fire-and-forget for bulk), the publish router, the catalog fan-out job, and the bulk import commit job. Each is a potential point of failure or inconsistency. If any surface forgets to call publish after a data change, the passport goes stale silently.

### 3.3 Bulk status change uses the slow path

The bulk update in `products/index.ts` fire-and-forgets `bulkPublishProducts()`, which loops product-by-product instead of using the optimized `publishProductsSetBased()`. This is both slower and less reliable (the user gets a success response before publishing finishes).

### 3.4 Integration re-sync does not republish

When the 24-hour integration sync updates product data (names, descriptions, variants), it does NOT trigger republishing for already-published products. Published passports silently show stale data until something else triggers a republish.

### 3.5 `firstPublishedAt` is semantically wrong

Passports are created on variant creation (not first publish), and `firstPublishedAt` is set at creation time. This means the timestamp is wrong for any passport that wasn't published immediately after variant creation.

### 3.6 Unpublish does not reliably hide the passport

The public read path (`getPublicDppByUpid`) checks `currentVersionId IS NOT NULL` but relies on RLS policy joining through `products.status`. The `dpp-public` router uses service-level DB access which bypasses RLS entirely. This means unpublished products may still be accessible via the public API.

### 3.7 Full JSONB snapshots are stored for every version

Each version stores the complete snapshot (typically 30-50KB of JSON). With 50k variants and multiple versions each, this grows quickly. Historical versions are rarely accessed but occupy the same storage as current versions.

---

## 4. Desired System Overview

### Core Principle: Separate Mutation from Materialization

No mutation path (product save, catalog edit, integration sync, bulk import) will ever generate a snapshot directly. Instead, all mutations that affect published passport data will mark the affected passports as "dirty." A single projector (background job + on-demand trigger) is the only code that generates snapshots and writes version records.

### The Dirty Flag

A new `dirty` boolean column on `product_passports` indicates that the passport's current snapshot is stale relative to the working data. The flag is set to `true` by any mutation that changes data feeding into the passport snapshot, but only when the product's status is `published` (there is no point marking unpublished passports dirty).

### Two Materialization Triggers

1. **On passport visit (synchronous):** When a public passport URL is visited, if the passport is dirty, the projector generates a fresh snapshot inline, writes a new version, clears the dirty flag, and serves the new snapshot. If the passport is not dirty, the existing snapshot is served directly (no computation).

2. **Background job (periodic):** A scheduled job runs at a configurable interval (default: every hour) and processes all dirty passports in batch using the existing set-based publisher infrastructure. This ensures the registry and any machine clients have reasonably fresh data without requiring a visitor to trigger materialization.

### Unpublish Semantics

When a user unpublishes a product, the public passport URL stops resolving (returns 404 or "passport unavailable"). No new snapshots are captured while unpublished. The version history remains intact and immutable for audit purposes. When the user republishes, the system marks the passport dirty, and the projector picks it up on the next cycle (or on the next visit).

### Historical Version Compression

Current (active) versions keep `data_snapshot` as JSONB for fast reads. When a version is superseded by a newer version, a background process compresses the JSONB with zstd and stores it in a `compressed_snapshot` bytea column, then nulls out `data_snapshot`. Decompression only happens on audit/historical access. This saves approximately 5-10x on storage for historical versions.

### Single Projector

All snapshot generation flows through one code path: the projector. It uses the existing `publishProductsSetBased()` infrastructure (set-based prefetch, chunking, content-hash deduplication) for batch processing, and a streamlined single-variant path for on-visit materialization. This eliminates the duplicated snapshot assembly code in `snapshot.ts` vs `publish-batch.ts`.

### Passport Identity Lifecycle

Passports are created with the variant (formalizing the current behavior). `firstPublishedAt` becomes nullable and is only set when the first version is actually written by the projector. This fixes the semantic incorrectness of the current system.

---

## 5. File Tree After Implementation

```
packages/db/src/schema/products/
├── products.ts                        # EDIT: no schema change needed
├── product-variants.ts                # EDIT: no schema change needed
├── product-passports.ts               # EDIT: add dirty column, make firstPublishedAt nullable
└── product-passport-versions.ts       # EDIT: add compressed_snapshot bytea column, make data_snapshot nullable

packages/db/src/queries/products/
├── publish.ts                         # EDIT: gut inline publish logic, replace with dirty-flag marking
├── publish-batch.ts                   # EDIT: rename/refactor to projector.ts (the single projector)
├── projector.ts                       # NEW (renamed from publish-batch.ts): single projector for all materialization
├── snapshot.ts                        # EDIT: keep as shared snapshot builder, remove duplication with publish-batch
├── passports.ts                       # EDIT: add markDirty(), batchMarkDirty(), fix firstPublishedAt
├── dpp-versions.ts                    # EDIT: add compression/decompression helpers
├── catalog-fan-out.ts                 # EDIT: no change (resolvers stay the same)
└── mark-dirty.ts                      # NEW: centralized dirty-marking logic with product status check

packages/db/src/queries/dpp/
└── public.ts                          # EDIT: add dirty-check + inline materialization on read

apps/api/src/trpc/routers/products/
├── index.ts                           # EDIT: replace inline publish calls with markDirty()
├── publish.ts                         # EDIT: simplify to status-flip + markDirty() + optional inline projection for small sets
└── variants.ts                        # EDIT: replace syncPassportMetadata + publish with markDirty()

apps/api/src/trpc/routers/catalog/
└── index.ts                           # EDIT: replace enqueueCatalogFanOut() with inline markDirty() calls

apps/api/src/trpc/routers/dpp-public/
└── index.ts                           # EDIT: add unpublish gate, trigger inline projection for dirty passports

apps/api/src/lib/
└── dpp-revalidation.ts                # EDIT: no structural change, still used after projection

packages/jobs/src/trigger/catalog/
└── fan-out.ts                         # DELETE: no longer needed (dirty marking is inline in catalog router)

packages/jobs/src/trigger/
├── bulk/commit-to-production.ts       # EDIT: replace inline publish with markDirty() after commit
├── integrations/sync.ts              # EDIT: add markDirty() for published products after sync
└── passports/                         # NEW directory
    ├── projector-job.ts               # NEW: periodic background job that processes all dirty passports
    └── compress-versions-job.ts       # NEW: background job that compresses superseded versions

packages/jobs/src/lib/
└── dpp-revalidation.ts                # EDIT: no structural change
```

---

## 6. Per-File Change Specification

### Phase 1: Dirty Flag Infrastructure

#### `packages/db/src/schema/products/product-passports.ts`
**Action: EDIT**

Add:
- `dirty` boolean column, default `false`, not null. Index on `(brand_id, dirty)` filtered where `dirty = true` for efficient batch queries.
- Make `firstPublishedAt` nullable (remove `.notNull()`). This fixes the semantic bug where passports created before first publish have an incorrect timestamp.

Remove:
- Nothing. All existing columns and policies stay.

#### `packages/db/src/queries/products/mark-dirty.ts`
**Action: CREATE**

New file containing:
- `markPassportDirty(db, passportId)` - Sets `dirty = true` on a single passport.
- `markPassportsDirtyByVariantIds(db, variantIds)` - Marks passports dirty for a set of variant IDs. Only marks passports whose associated product has `status = 'published'`.
- `markPassportsDirtyByProductIds(db, brandId, productIds)` - Marks passports dirty for all variants of the given products. Only marks passports whose associated product has `status = 'published'`.
- `markAllBrandPassportsDirty(db, brandId)` - Marks all passports dirty for a brand (used when brand-level data changes). Only marks passports whose associated product has `status = 'published'`.

All functions are simple UPDATE statements. No snapshot computation, no cross-table joins beyond finding the affected passport IDs.

#### `packages/db/src/queries/products/passports.ts`
**Action: EDIT**

Changes:
- `createProductPassport()` and `createPassportForVariant()`: Set `firstPublishedAt` to `null` instead of `new Date().toISOString()`. The projector will set it on first version write.
- `batchCreatePassportsForVariants()`: Same change, `firstPublishedAt` is null.
- Add new export: `clearDirtyFlag(db, passportId)` and `batchClearDirtyFlags(db, passportIds)` - Called by the projector after successful materialization.

### Phase 2: Rewire All Mutation Paths

#### `apps/api/src/trpc/routers/products/index.ts`
**Action: EDIT**

Changes to the `update` mutation:
- **Single mode (lines ~442-523):** When status is set to "published", instead of calling `publishProduct()`, call `markPassportsDirtyByProductIds()`. The product status is still set to "published" in the database. Remove the inline `publishProduct()` call entirely.
- **Bulk mode (lines ~391-439):** When status is set to "published", instead of fire-and-forgetting `bulkPublishProducts()`, call `markPassportsDirtyByProductIds()` for all selected products. This is a single UPDATE statement, so it completes instantly.
- When status is set to "unpublished": No dirty marking needed. Invalidate cache tags immediately so the public URL stops resolving.
- Keep `revalidateProduct()` calls as-is for the app-side cache.

What this simplifies: The update mutation no longer needs to wait for or fire-and-forget snapshot generation. It's a simple database write + dirty flag, always fast, always synchronous.

#### `apps/api/src/trpc/routers/products/publish.ts`
**Action: EDIT**

Changes:
- `publish.variant` mutation: Instead of calling `publishVariant()` (which generates a snapshot), call `markPassportDirty()` and optionally trigger the projector inline for this single variant (since the user explicitly clicked publish, they expect to see the result). This is the one case where inline projection is warranted for good UX.
- `publish.product` mutation: Mark all passports dirty for the product's variants, then trigger the projector inline for this product's variants.
- `publish.bulk` mutation: Mark all passports dirty. Do NOT project inline (too many variants). Return immediately. The background job will handle materialization.
- `publish.state` query: No change.

Note: For `publish.variant` and `publish.product`, the inline projection is the same code as the background projector, just invoked synchronously. This keeps the "single projector" principle intact.

#### `apps/api/src/trpc/routers/products/variants.ts`
**Action: EDIT**

Changes:
- After variant data updates (sync mutation, attribute updates), instead of calling `syncPassportMetadata()` + explicit publish, call `markPassportsDirtyByVariantIds()` for the affected variant(s).
- Remove any explicit publish calls from variant update paths.
- Keep `syncPassportMetadata()` calls since passport metadata (SKU, barcode) should still be kept in sync on the passport record itself.

#### `apps/api/src/trpc/routers/catalog/index.ts`
**Action: EDIT**

Changes:
- Remove `enqueueCatalogFanOut()` entirely. The 45-second debounce and background job are no longer needed because marking dirty is idempotent and essentially free. Setting `dirty = true` on a passport that's already dirty is a no-op, so there's no benefit to debouncing rapid edits.
- In each catalog entity's `afterSuccess` hook (for create/update/delete of manufacturers, materials, certifications, operators), replace the `enqueueCatalogFanOut()` call with an inline call to the appropriate resolver function from `catalog-fan-out.ts` (e.g., `findPublishedProductIdsByManufacturer()`), followed by `markPassportsDirtyByProductIds()`.
- The resolver + markDirty combination is two SQL queries (one SELECT to find affected products, one UPDATE to set dirty flags). This completes in milliseconds, well within the HTTP request lifecycle.

What this simplifies: Eliminates the fan-out background job entirely. No more 45-second delay, no Trigger.dev task, no per-brand concurrency queue. Catalog mutations are fully synchronous and self-contained.

#### `packages/jobs/src/trigger/catalog/fan-out.ts`
**Action: DELETE**

This file is no longer needed. All of its responsibilities (resolve affected products, mark dirty, revalidate cache) are now handled inline in the catalog router (for resolving + marking dirty) and by the projector job (for cache revalidation after materialization).

The resolver functions it depended on (`findPublishedProductIdsByManufacturer()`, etc.) remain in `catalog-fan-out.ts` and are now imported directly by the catalog router.

#### `packages/jobs/src/trigger/bulk/commit-to-production.ts`
**Action: EDIT**

Changes:
- After committing products to production, instead of calling `publishProductsSetBased()`, call `markPassportsDirtyByProductIds()` for all committed products that have status "published".
- The background projector job will handle materialization on its next cycle.

#### `packages/jobs/src/trigger/integrations/sync.ts`
**Action: EDIT**

Changes:
- After sync completes, add a new step: identify all products that were updated by the sync AND have `status = 'published'`, then call `markPassportsDirtyByProductIds()` for those products.
- This fixes the current gap where integration syncs silently leave published passports stale.

### Phase 3: The Single Projector

#### `packages/db/src/queries/products/projector.ts`
**Action: CREATE (refactored from publish-batch.ts)**

This is the heart of the new system. It consolidates all snapshot generation into one module.

Key functions:
- `projectSinglePassport(db, passportId)` - Generates snapshot for one passport. Used by the on-visit materialization path. Calls `buildSnapshotsForVariantChunk()` for a chunk of 1, compares content hash, writes version if changed, clears dirty flag, sets `firstPublishedAt` if this is the first version. Returns the snapshot (for serving to the visitor).
- `projectDirtyPassports(db, brandId, options?)` - Batch processes all dirty passports for a brand. Uses the existing set-based infrastructure (chunking, prefetching, content-hash dedup). Clears dirty flags after successful materialization. Sets `firstPublishedAt` on passports getting their first version.
- `projectDirtyPassportsAllBrands(db, options?)` - Iterates all brands with dirty passports and calls `projectDirtyPassports()` for each. Used by the background job.

Content hash deduplication is preserved: if the content hasn't actually changed (e.g., a change was reverted), no new version is written, but the dirty flag is still cleared.

What happens to `publish-batch.ts`: The core set-based snapshot assembly logic (`buildSnapshotsForVariantChunk()`, `publishVariantChunk()`) moves into `projector.ts`. The `publishProductsSetBased()` function is removed since no callers will need it.

What happens to `snapshot.ts`: The single-variant snapshot generation functions stay as a shared utility. `projector.ts` imports from `snapshot.ts` for the single-passport path.

#### `packages/db/src/queries/products/publish.ts`
**Action: EDIT (major simplification)**

Remove:
- `publishVariant()` - Replaced by projector
- `publishProduct()` - Replaced by projector
- `bulkPublishProducts()` - Replaced by projector

Keep:
- `hasPublishedVariants()` - Still useful for status queries
- `getPublishingState()` - Still useful for UI state

Add:
- Any helper functions needed by the new mutation paths (status validation, etc.)

This file goes from ~480 lines of complex cross-query logic to a small utility module.

#### `packages/jobs/src/trigger/passports/projector-job.ts`
**Action: CREATE**

New Trigger.dev scheduled task:
- Task ID: "passport-projector"
- Schedule: Configurable, default every hour
- Concurrency: 1 (global, prevents overlapping projector runs)
- Logic: Call `projectDirtyPassportsAllBrands()`, then revalidate cache for all materialized passports
- Logging: Report counts (passports projected, versions created, versions skipped unchanged)

#### `apps/api/src/trpc/routers/dpp-public/index.ts`
**Action: EDIT**

Changes to `getByPassportUpid`:
- After fetching the passport, check if the product status is "published". If not, return 404 / "passport unavailable". This fixes the unpublish gate bug.
- If the passport is dirty and the product status is "published", call `projectSinglePassport()` inline to generate a fresh snapshot before serving. Clear the dirty flag. This is the on-visit materialization path.
- If the passport is not dirty, serve the existing snapshot as before.

Changes to `getByBarcode`:
- Same dirty-check + inline projection logic.
- Same unpublish gate.

#### `packages/db/src/queries/dpp/public.ts`
**Action: EDIT**

Changes to `getPublicDppByUpid()`:
- Add a join or subquery to check `product_passports.dirty` status.
- Add a join or subquery to check `products.status` for the unpublish gate (via `working_variant_id -> product_variants -> products`).
- Return dirty flag and product status in the result so the router can decide whether to project inline.

### Phase 4: Historical Version Compression

#### `packages/db/src/schema/products/product-passport-versions.ts`
**Action: EDIT**

Add:
- `compressedSnapshot` bytea column, nullable. Stores the zstd-compressed version of the JSONB snapshot.
- `compressedAt` timestamp column, nullable. Records when the compression happened.
- Make `dataSnapshot` (the existing JSONB column) nullable. After compression, this is set to null to free space.

The active version (pointed to by `current_version_id`) always has `data_snapshot` populated. Historical versions may have `data_snapshot = null` and `compressed_snapshot` populated instead.

#### `packages/db/src/queries/products/dpp-versions.ts`
**Action: EDIT**

Add:
- `compressVersion(db, versionId)` - Compresses `data_snapshot` with zstd, stores in `compressed_snapshot`, nulls `data_snapshot`.
- `decompressVersion(db, versionId)` - Reads `compressed_snapshot`, decompresses, returns the JSONB. Used for audit/historical access.
- `batchCompressSupersededVersions(db, options?)` - Finds versions where the passport's `current_version_id` points to a different version (i.e., this version is superseded), and compresses them in batch.

#### `packages/jobs/src/trigger/passports/compress-versions-job.ts`
**Action: CREATE**

New Trigger.dev scheduled task:
- Task ID: "compress-passport-versions"
- Schedule: Daily (e.g., 3:00 AM)
- Logic: Call `batchCompressSupersededVersions()` to compress all historical versions that haven't been compressed yet.
- Safety: Only compresses versions that are NOT the current version for any passport.

#### `packages/db/src/queries/dpp/public.ts`
**Action: EDIT (additional change for Phase 4)**

Changes to `getPublicDppVersion()` (the historical version access function):
- If `data_snapshot` is null and `compressed_snapshot` is not null, decompress before returning.
- This is only used for audit/historical access, so the decompression latency is acceptable.

---

## 7. Implementation Phases

### Frontend Call Sites (No Code Changes Needed)

Two frontend components call publish tRPC mutations directly:
- `apps/app/src/hooks/use-passport-form.ts` (line 1236) - Calls `publish.product` after saving the passport form
- `apps/app/src/components/forms/passport/variant-form.tsx` (line 322) - Calls `publish.variant` after saving variant data

These do NOT need code changes because they call the tRPC endpoints (`publish.product` and `publish.variant`), which are being rewired server-side in Phase 2. The frontend contract (call publish after save, get a success response) remains the same. The difference is that the server-side endpoint now marks dirty + projects inline instead of running the old publish pipeline.

### Phase 1: Dirty Flag Infrastructure
**Dependencies: None**

1. Add `dirty` column to `product_passports` schema
2. Make `firstPublishedAt` nullable in schema
3. Run `bun db:generate` and `bun db:migrate`
4. Create `mark-dirty.ts` with all marking functions
5. Add `clearDirtyFlag()` / `batchClearDirtyFlags()` to `passports.ts`
6. Fix `createProductPassport()` and `batchCreatePassportsForVariants()` to set `firstPublishedAt = null`
7. Regenerate types with `bun types:generate`
8. Typecheck and lint

**Deliverable:** The dirty flag infrastructure exists but is not yet wired up. No behavioral changes.

### Phase 2: Rewire Mutation Paths
**Dependencies: Phase 1**

1. Edit `products/index.ts` - Replace inline publish with markDirty on status change
2. Edit `products/publish.ts` router - Simplify variant/product/bulk endpoints
3. Edit `products/variants.ts` router - Replace publish calls with markDirty
4. Edit `catalog/index.ts` - Remove `enqueueCatalogFanOut()`, replace with inline resolver + markDirty calls in afterSuccess hooks
5. Delete `catalog/fan-out.ts` job - No longer needed
6. Edit `bulk/commit-to-production.ts` job - Replace publish with markDirty
7. Edit `integrations/sync.ts` job - Add markDirty for published products after sync
8. Typecheck and lint

**Deliverable:** All mutation paths now mark dirty instead of generating snapshots. The catalog fan-out background job is eliminated. But no projector exists yet, so passports will be dirty and not materialized. This phase should be deployed together with Phase 3.

### Phase 3: The Single Projector
**Dependencies: Phase 2**

1. Create `projector.ts` by refactoring `publish-batch.ts` - extract core logic
2. Implement `projectSinglePassport()` for on-visit materialization
3. Implement `projectDirtyPassports()` for batch materialization
4. Implement `projectDirtyPassportsAllBrands()` for the background job
5. Create `projector-job.ts` Trigger.dev scheduled task
6. Edit `dpp-public/index.ts` - Add unpublish gate + dirty-check + inline projection
7. Edit `public.ts` query - Return dirty flag and product status
8. Simplify `publish.ts` query file (remove publishVariant, publishProduct, bulkPublishProducts)
9. Edit `publish.ts` router - Wire explicit publish endpoints to projector for inline projection
10. Typecheck and lint
11. End-to-end testing: publish, unpublish, catalog edit, integration sync, bulk import, public visit

**Deliverable:** The full dirty-flag + projector system is operational. Phases 2 and 3 should be deployed together.

### Phase 4: Historical Version Compression
**Dependencies: Phase 3**

1. Add `compressed_snapshot` and `compressed_at` columns to `product_passport_versions` schema
2. Make `data_snapshot` nullable
3. Run `bun db:generate` and `bun db:migrate`
4. Add compression/decompression helpers to `dpp-versions.ts` (install zstd library)
5. Create `compress-versions-job.ts` Trigger.dev scheduled task
6. Edit `public.ts` - Handle decompression for historical version access
7. Regenerate types
8. Typecheck and lint
9. Run compression job once to compress all existing historical versions

**Deliverable:** Historical versions are compressed, reducing storage by ~5-10x. Can be deployed independently after Phase 3 is stable.

---

## 8. Edge Cases and Test Cases

### Publishing

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| 1 | Product is unpublished, user edits product data | No dirty flag set. No snapshot generated. |
| 2 | Product is unpublished, user sets status to "published" | Product status changes to "published". All variant passports marked dirty. On next visit or projector run, snapshots are generated. `firstPublishedAt` is set on passports getting their first version. |
| 3 | Product is published, user edits product name | Passports for all variants of this product marked dirty. On next visit or projector run, new snapshots generated. Content hash prevents duplicate version if name was changed back. |
| 4 | Product is published, user edits variant-specific data | Only the affected variant's passport is marked dirty. |
| 5 | Bulk publish: user selects 5,000 unpublished products and sets to "published" | All 5,000 products get status "published". All variant passports marked dirty (single UPDATE, milliseconds). Background projector materializes them on next cycle. |
| 6 | Published product, three catalog edits in 30 minutes | Each edit resolves affected products inline and marks passports dirty (milliseconds each, idempotent). Projector runs once per hour and materializes all dirty passports in one batch. Net result: three cheap UPDATE statements + one materialization cycle. |

### Unpublishing

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| 7 | User unpublishes a product | Product status set to "unpublished". Cache tags invalidated immediately. Public URL returns 404. No dirty flag changes needed. Version history preserved. |
| 8 | User unpublishes then republishes | On republish, passports marked dirty. Projector generates new snapshot (reflecting any changes made while unpublished). |
| 9 | Orphaned passport (variant deleted) visited | Passport served from last published snapshot. No dirty-check needed (no working variant to rebuild from). |

### Projector

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| 10 | Dirty passport visited by customer | Projector runs inline, generates snapshot, writes version, clears dirty flag, serves fresh snapshot. Latency: ~50-100ms added to request. |
| 11 | Dirty passport where content hasn't actually changed (reverted edit) | Projector generates snapshot, content hash matches current version, no new version written, dirty flag cleared. |
| 12 | Projector job runs with no dirty passports | Job completes immediately with zero work. |
| 13 | Projector job runs with 50k dirty passports | Processes in chunks of 500. Content-hash deduplication skips unchanged passports. Writes only changed versions. Revalidates cache for materialized passports. |
| 14 | Projector job fails mid-batch | Dirty flags on unprocessed passports remain set. Next job run picks them up. No data corruption (versions are append-only). |
| 15 | Two projector jobs try to run simultaneously | Concurrency limit of 1 prevents overlap. Second job waits or is skipped. |

### Integration Sync

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| 16 | Sync updates product name on a published product | Passports marked dirty after sync. Projector materializes on next cycle. Fixes current gap. |
| 17 | Sync creates new variant on unpublished product | Passport created with `firstPublishedAt = null`. No dirty flag (product is unpublished). |
| 18 | Sync updates data on unpublished product | No dirty flag set. Data saved in working layer only. |

### Compression

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| 19 | Active version is never compressed | Compression job only targets versions where `id != passport.current_version_id`. Active version always retains full JSONB. |
| 20 | Historical version accessed for audit | `data_snapshot` is null, `compressed_snapshot` is populated. System decompresses on read. Returns full JSONB to caller. |
| 21 | Compression job runs with no superseded versions | Job completes immediately with zero work. |

### Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| 22 | Variant has no UPID | Passport cannot be created (UPID required). Dirty flag is not set. Projector skips variants without passports. |
| 23 | Passport exists but working variant was deleted (orphaned) | Passport serves last known snapshot. Marking dirty has no effect (no working variant to rebuild from). |
| 24 | Brand is deleted | Passports persist (brandId set to null via ON DELETE SET NULL). Orphaned passports still serve last snapshot. Projector skips passports with null brandId. |
| 25 | Concurrent edits to same product | Both edits mark passport dirty. Projector materializes once against the latest state. Only one version written. |
| 26 | Product published for first time, visitor arrives before projector runs | Passport is dirty, inline projection generates the first snapshot. `firstPublishedAt` is set. Visitor sees the passport. |
