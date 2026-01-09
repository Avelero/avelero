# Bulk Import Research Document

> **Document Purpose:** Comprehensive snapshot of the current bulk import implementation  
> **Created:** 2026-01-09  
> **Intended Use:** Context for future coding agents implementing bulk import refactoring

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Two-Phase Import Workflow](#two-phase-import-workflow)
4. [File Parsing & Validation](#file-parsing--validation)
5. [Database Schema](#database-schema)
6. [API Layer (tRPC Routers)](#api-layer-trpc-routers)
7. [Background Jobs (Trigger.dev)](#background-jobs-triggerdev)
8. [Frontend Components](#frontend-components)
9. [Value Mapping & Entity Resolution](#value-mapping--entity-resolution)
10. [CSV Template Format](#csv-template-format)
11. [Key File Locations](#key-file-locations)
12. [Current Limitations & Pain Points](#current-limitations--pain-points)

---

## Executive Summary

The current Avelero bulk import system enables users to upload CSV or Excel files containing product data. It follows a **two-phase workflow**:

1. **Phase 1 (Validation & Staging):** Parse file, validate rows, resolve entities, populate staging tables
2. **Phase 2 (Production Commit):** After user approval, commit staging data to production tables

Key characteristics of the current implementation:

- **File Format:** CSV (primary) or XLSX (Excel) - both supported via PapaParse and xlsx libraries
- **Row Structure:** One variant per row, with `upid` (Unique Product Identifier) or `sku` as the primary matching key
- **Entity Matching:** Uses fixed color/size variant model with `colorId` and `sizeId` columns in staging
- **Import Mode:** Single implicit mode - creates new products if UPID doesn't exist, updates if it does
- **User Confirmation Required:** Users must explicitly approve the import after reviewing staging data
- **Processing:** Background jobs via Trigger.dev with WebSocket progress updates

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BULK IMPORT ARCHITECTURE                            │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │   Frontend App  │
                              │ (apps/app)      │
                              └────────┬────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    ▼                  ▼                  ▼
         ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
         │ Import Review   │ │ Import Progress │ │ Upload Sheet    │
         │ Dialog          │ │ Context         │ │ (File Upload)   │
         └────────┬────────┘ └────────┬────────┘ └────────┬────────┘
                  │                   │                   │
                  └─────────────┬─────┴───────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │      tRPC API         │
                    │   (apps/api/trpc)     │
                    └───────────┬───────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐     ┌───────────────┐      ┌───────────────┐
│ bulk.import   │     │ bulk.staging  │      │ bulk.values   │
│   Router      │     │   Router      │      │   Router      │
│               │     │               │      │               │
│ • start       │     │ • preview     │      │ • unmapped    │
│ • status      │     │ • errors      │      │ • define      │
│ • approve     │     │ • export      │      │ • batchDefine │
│ • cancel      │     │ • reviewSummary│     │ • mapToExisting│
└───────┬───────┘     └───────────────┘      │ • ensureCategory│
        │                                    └───────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                         Trigger.dev Background Jobs                        │
│                         (packages/jobs/src/trigger/bulk)                   │
├───────────────────────────────────┬───────────────────────────────────────┤
│     validate-and-stage.ts         │      commit-to-production.ts          │
│     (Phase 1)                     │      (Phase 2)                        │
│                                   │                                       │
│ • Download file from Supabase     │ • Read staging data                   │
│ • Parse CSV/XLSX                  │ • Create/Update products              │
│ • Validate each row               │ • Create/Update variants              │
│ • Detect duplicates               │ • Process related entities            │
│ • Load brand catalog              │ • Cleanup staging tables              │
│ • Match/create entities           │ • Update job status                   │
│ • Populate staging tables         │ • Trigger DPP revalidation            │
│ • Track unmapped values           │                                       │
│ • Update job status               │                                       │
└───────────────────────────────────┴───────────────────────────────────────┘
        │                                       │
        ▼                                       ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                              PostgreSQL Database                           │
│                              (via Drizzle ORM)                             │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐   │
│  │   import_jobs   │  │   import_rows   │  │    value_mappings       │   │
│  │                 │  │                 │  │                         │   │
│  │ • id            │  │ • id            │  │ • source_column         │   │
│  │ • brand_id      │  │ • job_id        │  │ • raw_value             │   │
│  │ • filename      │  │ • row_number    │  │ • target (entity type)  │   │
│  │ • status        │  │ • raw (JSONB)   │  │ • target_id             │   │
│  │ • started_at    │  │ • normalized    │  └─────────────────────────┘   │
│  │ • finished_at   │  │ • error         │                                │
│  │ • summary       │  │ • status        │                                │
│  └─────────────────┘  └─────────────────┘                                │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                     STAGING TABLES                                   │ │
│  ├─────────────────────────────────────────────────────────────────────┤ │
│  │ staging_products              │ staging_product_variants            │ │
│  │ • staging_id                  │ • staging_id                        │ │
│  │ • job_id                      │ • staging_product_id                │ │
│  │ • row_number                  │ • job_id                            │ │
│  │ • action (CREATE/UPDATE)      │ • row_number                        │ │
│  │ • existing_product_id         │ • action (CREATE/UPDATE)            │ │
│  │ • id (target product id)      │ • existing_variant_id               │ │
│  │ • brand_id                    │ • id (target variant id)            │ │
│  │ • name                        │ • product_id                        │ │
│  │ • description                 │ • color_id                          │ │
│  │ • manufacturer_id             │ • size_id                           │ │
│  │ • image_path                  │ • upid                              │ │
│  │ • category_id                 │                                     │ │
│  │ • season_id                   │                                     │ │
│  │ • product_handle              │                                     │ │
│  │ • status                      │                                     │ │
│  ├───────────────────────────────┴─────────────────────────────────────┤ │
│  │ staging_product_materials     │ staging_product_journey_steps       │ │
│  │ staging_product_environment   │ staging_eco_claims                  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Two-Phase Import Workflow

### Phase 1: Validation & Staging

**Trigger:** User uploads file and clicks "Import"

**Process Flow:**
1. File uploaded to Supabase Storage (`product-imports` bucket)
2. `import_jobs` record created with status `PENDING`
3. Background job `validate-and-stage` triggered via Trigger.dev
4. Job status updated to `VALIDATING`
5. File downloaded from Supabase Storage
6. CSV/XLSX parsed with PapaParse/xlsx library
7. Headers normalized (lowercase, spaces → underscores, alias mapping)
8. Duplicate detection (UPID duplicates + composite key duplicates)
9. Brand catalog loaded into memory (materials, categories, colors, etc.)
10. Each row validated in batches of 250:
    - Required fields checked
    - Entity references resolved (categories, seasons, manufacturers, etc.)
    - Existing variants looked up by UPID
    - CREATE vs UPDATE action determined
    - Validation errors/warnings collected
11. Staging tables populated with validated data
12. Unmapped values tracked for user approval
13. Job status updated to `VALIDATED`

### User Review Phase

**Between Phases:**
- User reviews staging preview via `ImportReviewDialog`
- Sees summary: X products to create, Y to update, Z errors
- Must resolve any unmapped values (define new entities or map to existing)
- Can cancel (discards staging data) or approve (triggers Phase 2)

### Phase 2: Production Commit

**Trigger:** User clicks "Approve" button

**Process Flow:**
1. Job status updated to `COMMITTING`
2. Background job `commit-to-production` triggered
3. Staging data read in batches of 1000
4. For each staging product:
   - CREATE: Insert new product + variant + related data
   - UPDATE: Update existing product/variant fields
5. Related entities processed (materials, journey steps, eco claims)
6. Staging data cleaned up after successful commit
7. Job status updated to `COMPLETED`
8. DPP pages revalidated for the brand

### Job Status Values

| Status | Description |
|--------|-------------|
| `PENDING` | Job created, awaiting background processing |
| `VALIDATING` | Phase 1 background job running |
| `VALIDATED` | Phase 1 complete, awaiting user approval |
| `COMMITTING` | Phase 2 background job running |
| `COMPLETED` | Import finished successfully |
| `FAILED` | Job failed due to error |
| `CANCELLED` | User cancelled the import |

---

## File Parsing & Validation

### Supported File Formats

| Format | Library | Notes |
|--------|---------|-------|
| CSV | PapaParse | RFC 4180 compliant, handles quotes, newlines in fields |
| XLSX/XLS | xlsx (`sheetjs`) | Excel 2007+ format |

**Location:** `apps/api/src/lib/csv-parser.ts`

### Header Normalization

```typescript
// Example: "Product Name" → "product_name"
function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}
```

**Header Aliases Supported:**
- `color_name` → `colors`
- `size_name` → `size`
- `category_name` → `category`
- `upid` ↔ `sku` (both work)

### Duplicate Detection

Two-level duplicate detection:

1. **UPID Duplicates:** Same UPID value appears multiple times in file
2. **Composite Key Duplicates:** Same `product_handle + colors + size` combination

Rows with duplicates receive hard errors and cannot be imported.

### CSV Row Structure (Current)

```typescript
interface CSVRow {
  // Required
  product_name: string;      // Max 100 chars
  product_handle: string;    // Unique product identifier
  upid?: string;             // Unique variant identifier (auto-generated if not provided)

  // Basic Information
  description?: string;      // Max 2000 chars
  status?: string;           // draft|published|archived
  manufacturer?: string;     // Manufacturer name

  // Organization
  category?: string;         // Hierarchical path: "Men's > Tops > T-Shirts"
  season?: string;           // Season name: "SS 2025"
  colors?: string;           // Pipe-separated: "Blue|Green"
  size?: string;             // Size name: "M", "L"

  // Environment
  carbon_footprint?: string; // kg CO2e
  water_usage?: string;      // liters
  eco_claims?: string;       // Pipe-separated claims

  // Materials (complex format)
  materials?: string;        // "Name:Percentage[:Country:Recyclable:CertTitle:CertNumber:CertExpiry]|..."

  // Journey Steps (complex format)
  journey_steps?: string;    // "StepName@Operator1,Operator2|NextStep@Operator3"

  // Images
  image_url?: string;        // Single URL
}
```

---

## Database Schema

### Import Job Tracking

**Table: `import_jobs`**
```sql
CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  commit_started_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'PENDING',
  requires_value_approval BOOLEAN NOT NULL DEFAULT false,
  summary JSONB
);
```

**Table: `import_rows`**
```sql
CREATE TABLE import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  raw JSONB NOT NULL,           -- Original CSV row data
  normalized JSONB,             -- Parsed/validated data
  error TEXT,                   -- Error message if validation failed
  status TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING|VALIDATED|APPLIED|FAILED
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id, row_number)
);
```

### Staging Tables

**Table: `staging_products`**
- `staging_id` (PK)
- `job_id` → `import_jobs`
- `row_number`
- `action` (CREATE|UPDATE)
- `existing_product_id` → `products` (for UPDATE)
- `id` (target product UUID)
- `brand_id`, `name`, `description`, `manufacturer_id`, `image_path`
- `category_id`, `season_id`, `product_handle`, `product_upid`, `status`

**Table: `staging_product_variants`**
- `staging_id` (PK)
- `staging_product_id` → `staging_products`
- `job_id` → `import_jobs`
- `row_number`
- `action` (CREATE|UPDATE)
- `existing_variant_id` → `product_variants` (for UPDATE)
- `id` (target variant UUID)
- `product_id`
- `color_id`, `size_id` ← **Fixed color/size model**
- `upid`

**Related Staging Tables:**
- `staging_product_materials`
- `staging_product_environment`
- `staging_product_journey_steps`
- `staging_eco_claims`

### Value Mappings

**Table: `value_mappings`**
```sql
CREATE TABLE value_mappings (
  id UUID PRIMARY KEY,
  brand_id UUID NOT NULL,
  source_column TEXT NOT NULL,
  raw_value TEXT NOT NULL,
  target TEXT NOT NULL,        -- Entity type: MATERIAL, COLOR, SIZE, FACILITY, etc.
  target_id UUID,              -- Resolved entity ID
  UNIQUE(brand_id, source_column, raw_value)
);
```

---

## API Layer (tRPC Routers)

### Router Structure

```
bulk (bulkRouter)
├── import (importRouter)
│   ├── start       - Create job, trigger Phase 1
│   ├── status      - Get job status and progress
│   ├── approve     - Trigger Phase 2 commit
│   └── cancel      - Cancel and discard staging
│
├── staging (stagingRouter)
│   ├── preview     - Paginated staging data preview
│   ├── errors      - Paginated error list
│   ├── export      - Export failed rows as CSV
│   └── reviewSummary - All-in-one review data fetch
│
└── values (valuesRouter)
    ├── unmapped      - Get values needing definition
    ├── catalogData   - Get all catalog entities for mapping
    ├── define        - Create single entity inline
    ├── batchDefine   - Create multiple entities
    ├── mapToExisting - Map CSV value to existing entity
    └── ensureCategory - Create category path if needed
```

### Key Router Files

| File | Purpose |
|------|---------|
| `apps/api/src/trpc/routers/bulk/import.ts` | Import lifecycle (start, status, approve, cancel) |
| `apps/api/src/trpc/routers/bulk/staging.ts` | Staging data operations |
| `apps/api/src/trpc/routers/bulk/values.ts` | Entity definition and mapping |
| `apps/api/src/trpc/routers/bulk/index.ts` | Router barrel export |

### Schema Definitions

**Location:** `apps/api/src/schemas/bulk.ts`

Key schemas:
- `startImportSchema` - File ID and filename validation
- `getStagingPreviewSchema` - Pagination params
- `defineValueSchema` - Entity type + data for inline creation
- `entityTypeSchema` - Enum: MATERIAL, ECO_CLAIM, FACILITY, MANUFACTURER, CERTIFICATION, SEASON, CATEGORY, TAG

---

## Background Jobs (Trigger.dev)

### Job: validate-and-stage

**Location:** `packages/jobs/src/trigger/bulk/validate-and-stage.ts`

**Configuration:**
- Max duration: 30 minutes
- Concurrency limit: 5 jobs
- Retry: 2 attempts with exponential backoff
- Batch size: 250 rows

**Key Functions:**
- `downloadFileFromSupabase()` - Fetch file from storage
- `parseFile()` - Parse CSV/XLSX
- `findDuplicates()` / `findCompositeDuplicates()` - Detect duplicates
- `loadBrandCatalog()` - Load catalog into memory (optimization)
- `validateRow()` - Validate single row, resolve entities
- `batchInsertStagingWithStatus()` - Batch insert staging records

### Job: commit-to-production

**Location:** `packages/jobs/src/trigger/bulk/commit-to-production.ts`

**Configuration:**
- Max duration: 30 minutes
- Concurrency limit: 3 jobs
- Retry: 2 attempts with exponential backoff
- Batch size: 1000 rows
- Row concurrency: Configurable via environment

**Key Functions:**
- `getStagingPreview()` - Read staging data in batches
- `processBatch()` - Process batch with transaction rollback on failure
- `commitStagingRow()` - Commit single row (CREATE or UPDATE)
- `revalidateBrand()` - Trigger DPP revalidation after commit

### Progress Updates

**Location:** `packages/jobs/src/trigger/bulk/progress-emitter.ts`

Debounced progress updates (max once per second) sent via WebSocket to connected clients.

---

## Frontend Components

### Import Review Dialog

**Location:** `apps/app/src/components/import/import-review-dialog.tsx`

Side panel (Sheet) for reviewing staging data before approval:
- Summary statistics (products to create/update, errors)
- Staging data preview table
- Unmapped values section (requires resolution before approval)
- Error list with export option
- Action buttons: Cancel / Approve Import

### Import Progress Context

**Location:** `apps/app/src/contexts/import-progress-context.tsx`

React context managing import state:
- `state` - Current job ID, status, progress, filename
- `startImport()` - Initialize new import
- `cancelImport()` - Cancel and cleanup
- `openReviewDialog()` / `closeReviewDialog()` - Dialog visibility
- Persists state to localStorage for page refresh survival
- Polls job status API for updates

### WebSocket Integration

**Client Hook:** `apps/app/src/hooks/use-import-websocket.ts`
- JWT authentication
- Auto-reconnection with exponential backoff
- Subscribe/unsubscribe to job-specific updates
- Heartbeat/ping-pong keepalive

**Server Manager:** `apps/api/src/lib/websocket-manager.ts`
- Connection lifecycle management
- Job-specific subscriptions
- Progress event broadcasting

---

## Value Mapping & Entity Resolution

### Entity Types (Current)

| Entity Type | Database Table | Auto-Created? |
|-------------|----------------|---------------|
| MATERIAL | `brand_materials` | Needs definition |
| ECO_CLAIM | `brand_eco_claims` | Auto-created |
| FACILITY | `brand_facilities` | Needs definition |
| MANUFACTURER | `brand_manufacturers` | Needs definition |
| CERTIFICATION | `brand_certifications` | Needs definition |
| SEASON | `brand_seasons` | Needs definition |
| CATEGORY | `taxonomy_categories` | Must exist (hierarchical) |
| TAG | `brand_tags` | Auto-created |

### Resolution Flow

1. **During Validation (Phase 1):**
   - CSV value extracted from column
   - Check `value_mappings` for existing mapping
   - If mapped → use `target_id`
   - If unmapped → check catalog for exact match
   - If match found → auto-map
   - If no match → add to `pending_approval` in job summary

2. **During Review:**
   - User sees unmapped values in `UnmappedValuesSection`
   - For each value, user can:
     - Create new entity → `values.define` or `values.batchDefine`
     - Map to existing → `values.mapToExisting`
   - Mapping stored in `value_mappings` table

3. **During Commit (Phase 2):**
   - All values already resolved
   - Entity IDs from staging tables used directly

### Catalog Loading Optimization

**Location:** `packages/jobs/src/lib/catalog-loader.ts`

Full brand catalog loaded into memory at start of validation to avoid N+1 queries:
- Materials (`brand_materials`)
- Categories (`taxonomy_categories`)
- Seasons (`brand_seasons`)
- Colors, Sizes, etc.
- Existing value mappings

---

## CSV Template Format

### Template Files

| File | Location |
|------|----------|
| CSV Template | `apps/api/public/templates/product-import-template.csv` |
| Documentation | `apps/api/public/templates/README.md` |
| Excel Template (new) | `apps/api/public/templates/avelero-bulk-import-template.xlsx` |

### Required Columns

- `product_name` - Product display name
- `product_identifier` or `sku` - At least one required for matching

### Complex Field Formats

**Materials:**
```
Name:Percentage[:Country:Recyclable:CertTitle:CertNumber:CertExpiry]|...

Examples:
Cotton:100
Organic Cotton:75:TR:yes|Recycled Polyester:25
Organic Cotton:95:TR:yes:GOTS:GOTS-2024-001:2026-12-31|Elastane:5
```

**Journey Steps:**
```
StepName@Operator1,Operator2|NextStep@Operator3

Examples:
Spinning@Eco Spinners|Weaving@Green Textiles
Fiber Production@Turkish Cotton Co|Spinning@Eco Spinners|Dyeing@Natural Dye Works
```

**Colors (pipe-separated):**
```
Navy Blue|Forest Green|White
```

---

## Key File Locations

### API Layer
- `apps/api/src/trpc/routers/bulk/import.ts` - Import lifecycle router
- `apps/api/src/trpc/routers/bulk/staging.ts` - Staging operations router
- `apps/api/src/trpc/routers/bulk/values.ts` - Value mapping router
- `apps/api/src/schemas/bulk.ts` - Zod validation schemas
- `apps/api/src/lib/csv-parser.ts` - File parsing utilities
- `apps/api/src/lib/websocket-manager.ts` - WebSocket connection manager

### Background Jobs
- `packages/jobs/src/trigger/bulk/validate-and-stage.ts` - Phase 1 job
- `packages/jobs/src/trigger/bulk/commit-to-production.ts` - Phase 2 job
- `packages/jobs/src/trigger/bulk/progress-emitter.ts` - Progress broadcasting
- `packages/jobs/src/lib/catalog-loader.ts` - Catalog memory loading

### Database Layer
- `packages/db/src/schema/data/import-jobs.ts` - Import job table
- `packages/db/src/schema/data/import-rows.ts` - Import row table
- `packages/db/src/schema/staging/staging-products.ts` - Staging product table
- `packages/db/src/schema/staging/staging-product-variants.ts` - Staging variant table
- `packages/db/src/schema/staging/value-mappings.ts` - Value mappings table
- `packages/db/src/queries/bulk/` - Query functions

### Frontend
- `apps/app/src/components/import/import-review-dialog.tsx` - Review UI
- `apps/app/src/contexts/import-progress-context.tsx` - State management
- `apps/app/src/hooks/use-import-websocket.ts` - WebSocket hook

### Templates
- `apps/api/public/templates/product-import-template.csv` - CSV template
- `apps/api/public/templates/README.md` - Template documentation
- `apps/api/public/templates/avelero-bulk-import-template.xlsx` - Excel template

---

## Current Limitations & Pain Points

### Row Structure Issues

1. **One Row = One Variant:** Current structure requires separate row for each variant, leading to repetitive product data
2. **No Variant Grouping:** No concept of grouping variants under a parent product row
3. **No Variant-Level Overrides:** Cannot override product-level fields for specific variants

### Entity Matching Issues

1. **Fixed Color/Size Model:** Staging tables have hardcoded `color_id` and `size_id` columns instead of generalizable attributes
2. **No Auto-Creation for Complex Entities:** Materials, facilities, manufacturers require manual definition
3. **Manual Category Creation:** Categories must exist beforehand; no auto-creation

### Import Mode Issues

1. **Single Implicit Mode:** No distinction between "create new products" vs "enrich existing products"
2. **UPID-Based Matching Only:** Matching based on UPID/SKU, no alternative matching strategies

### User Experience Issues

1. **User Confirmation Required:** Users must explicitly approve after Phase 1, even for simple imports
2. **No Error Export with Highlighting:** Failed rows exported as plain CSV without visual indication of error cells
3. **No Import History UI:** No easy way to view past imports and their results

### Technical Debt

1. **CSV Focus:** While XLSX is supported, the mental model and documentation focus on CSV
2. **Color/Size Legacy:** Staging schema still references removed color/size entity types
3. **Entity Type Inconsistency:** `entityTypeSchema` includes types that don't fully align with database structure

---

## Appendix: Job Summary Structure

The `import_jobs.summary` JSONB column stores:

```typescript
interface ImportJobSummary {
  total: number;           // Total rows processed
  processed: number;       // Rows processed so far
  created: number;         // Products/variants created
  updated: number;         // Products/variants updated
  failed: number;          // Rows that failed validation

  // Unmapped values needing user definition
  pending_approval: Array<{
    type: string;          // Entity type
    name: string;          // Raw value from CSV
    affected_rows: number; // How many rows reference this value
    source_column: string; // Which CSV column
  }>;

  // Values that have been defined/mapped
  approved_values: Array<{
    type: string;
    name: string;
    entityId: string;
  }>;

  // Error details (if job failed)
  error?: string;
}
```

---

## Appendix: Import Row Status Values

| Status | Description |
|--------|-------------|
| `PENDING` | Row not yet processed |
| `MAPPED` | Values mapped, ready for commit |
| `VALIDATED` | Row validated successfully |
| `APPLIED` | Row committed to production |
| `FAILED` | Row failed validation with error |
