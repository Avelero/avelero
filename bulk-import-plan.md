# Bulk Import Implementation Plan

> **Created:** 2026-01-09
> **Purpose:** Detailed implementation blueprint for bulk import refactor
> **Prerequisites:** Read `bulk-import-research.md` (current state) and `bulk-import-refactor-plan.md` (target state)

---

## Progress Tracker

### Phase 1: Database Migrations ✅ COMPLETE
| Task | Status | Notes |
|------|--------|-------|
| 1.1 Modify `import_jobs` table | ✅ Done | Added `mode` and `hasExportableFailures` columns |
| 1.2 Modify `staging_product_variants` | ✅ Done | Removed colorId/sizeId, added barcode, sku, overrides, rowStatus, errors |
| 1.3 Modify `staging_products` | ✅ Done | Added rowStatus and errors columns |
| 1.4 Create `staging_variant_attributes` | ✅ Done | New file with RLS policies |
| 1.5 Create `staging_product_tags` | ✅ Done | New file with RLS policies |
| 1.6 Create `staging_product_weight` | ✅ Done | New file with RLS policies |
| 1.7 Create `staging_variant_materials` | ✅ Done | New file with RLS policies |
| 1.8 Create `staging_variant_eco_claims` | ✅ Done | New file with RLS policies |
| 1.9 Create `staging_variant_environment` | ✅ Done | New file with RLS policies |
| 1.10 Create `staging_variant_journey_steps` | ✅ Done | New file with RLS policies |
| 1.11 Create `staging_variant_weight` | ✅ Done | New file with RLS policies |
| 1.12 Update schema index | ✅ Done | Added exports for all new staging tables |
| Type fixes in `types.ts` | ✅ Done | Updated interfaces for new fields |
| Type fixes in `preview.ts` | ✅ Done | Updated variant mapping |

**Note:** Migrations not yet applied - run `bun db:generate && bun db:migrate` when ready.

### UI Cleanup ✅ COMPLETE
| Task | Status | Notes |
|------|--------|-------|
| Delete `apps/app/src/components/import/` | ✅ Done | Entire folder deleted (11 files) |
| Delete `apps/app/src/components/sheets/upload-sheet.tsx` | ✅ Done | Removed upload sheet component |
| Delete `apps/app/src/contexts/import-progress-context.tsx` | ✅ Done | Removed progress tracking context |
| Delete `apps/app/src/hooks/use-import-websocket.ts` | ✅ Done | Removed websocket hook |
| Delete `apps/app/src/lib/csv-validation.ts` | ✅ Done | Removed CSV validation logic |
| Update `layout.tsx` | ✅ Done | Removed FloatingProgressWidget and ImportReviewDialog |
| Update passports list layout | ✅ Done | Removed PassportsUploadSheet |

### Phase 2: API/Backend Changes ✅ COMPLETE
| Task | Status | Notes |
|------|--------|-------|
| 2.1 Update bulk import schemas | ✅ Done | Added importModeSchema, updated startImportSchema with mode, added exportCorrectionsSchema, dismissFailedImportSchema, getRecentImportsSchema, stagingRowStatusSchema |
| 2.2 Update import router | ✅ Done | Modified start to accept mode, added getRecentImports/dismiss/exportCorrections, deprecated approve/cancel |
| 2.3 Simplify values router | ✅ Done | Added deprecation comments to define/batchDefine/mapToExisting, updated unmapped description |
| 2.4 Update staging router | ✅ Done | Added status filter to preview, added rowStatus/errors to response, deprecated export |

### Phase 3: Background Job Changes ✅ COMPLETE
| Task | Status | Notes |
|------|--------|-------|
| 3.1 Create Excel parser | ✅ Done | `packages/jobs/src/lib/excel-parser.ts` - Shopify-style row grouping, variant-level overrides |
| 3.2 Create Excel export | ✅ Done | `packages/jobs/src/lib/excel-export.ts` - Correction export with red cell highlighting |
| 3.3 Rewrite validate-and-stage | ✅ Done | ~836 lines (down from 1867). Auto-create entities, CREATE/ENRICH modes, fire-and-forget |
| 3.4 Update commit-to-production | ✅ Done | ~596 lines (down from 825). Auto-triggered, per-row status, variant-level overrides |
| 3.5 Create staging cleanup job | ✅ Done | `packages/jobs/src/trigger/bulk/staging-cleanup.ts` - Daily scheduled cleanup |
| 3.6 Update catalog-loader | ✅ Done | Extended with attributes, tags, ecoClaims, manufacturers maps |
| Delete csv-parser.ts | ✅ Done | No longer needed with Excel-only flow |

### Phase 4: UI Changes 🔲 NOT STARTED
| Task | Status |
|------|--------|
| 4.1 Create import modal | 🔲 |
| 4.2 Create recent imports section | 🔲 |
| 4.3 Create mode selector | 🔲 |
| 4.4 Update import progress context | 🔲 |

---

## Table of Contents

1. [File Tree Changes Overview](#file-tree-changes-overview)
2. [Phase 1: Database Migrations](#phase-1-database-migrations)
3. [Phase 2: API/Backend Changes](#phase-2-apibackend-changes)
4. [Phase 3: Background Job Changes](#phase-3-background-job-changes)
5. [Phase 4: UI Changes](#phase-4-ui-changes)
6. [Files to Delete](#files-to-delete)
7. [Implementation Order](#implementation-order)

---

## File Tree Changes Overview

### New File Tree Structure

```
packages/
├── db/
│   └── src/
│       ├── schema/
│       │   ├── data/
│       │   │   └── import-jobs.ts              # MODIFY: Add mode, new status values
│       │   └── staging/
│       │       ├── staging-products.ts          # MODIFY: Add status, errors columns
│       │       ├── staging-product-variants.ts  # MODIFY: Add override fields, barcode, sku, status, errors, remove color/size
│       │       ├── staging-product-tags.ts      # CREATE: Product-level tags
│       │       ├── staging-product-weight.ts    # CREATE: Product-level weight (optional, variant can override)
│       │       ├── staging-product-materials.ts # EXISTS: Keep, references staging_product
│       │       ├── staging-product-journey-steps.ts # EXISTS: Keep, references staging_product
│       │       ├── staging-product-environment.ts   # EXISTS: Keep, references staging_product
│       │       ├── staging-eco-claims.ts        # EXISTS: Keep (rename to staging-product-eco-claims)
│       │       ├── staging-variant-attributes.ts    # CREATE: Generalizable attributes per variant
│       │       ├── staging-variant-materials.ts     # CREATE: Variant-level material overrides
│       │       ├── staging-variant-eco-claims.ts    # CREATE: Variant-level eco claim overrides
│       │       ├── staging-variant-environment.ts   # CREATE: Variant-level environment overrides
│       │       ├── staging-variant-journey-steps.ts # CREATE: Variant-level journey step overrides
│       │       ├── staging-variant-weight.ts        # CREATE: Variant-level weight overrides
│       │       └── value-mappings.ts            # EXISTS: Keep (may simplify with auto-create)
│       └── queries/
│           └── bulk/
│               ├── staging/
│               │   ├── insert.ts               # MODIFY: Handle new attribute structure
│               │   ├── preview.ts              # MODIFY: Include per-row status/errors
│               │   ├── export-corrections.ts   # CREATE: Generate correction export data
│               │   └── cleanup.ts              # MODIFY: Lifecycle-based cleanup
│               └── import/
│                   ├── jobs.ts                 # MODIFY: Add recent imports query
│                   └── dismiss.ts              # CREATE: Dismiss failed import
│
├── jobs/
│   └── src/
│       ├── lib/
│       │   ├── excel-parser.ts                 # CREATE: XLSX parsing with row grouping
│       │   ├── excel-export.ts                 # CREATE: Correction export with red cells
│       │   ├── catalog-loader.ts               # MODIFY: Remove color/size, add attributes
│       │   └── csv-parser.ts                   # DELETE: No longer needed
│       └── trigger/
│           └── bulk/
│               ├── validate-and-stage.ts       # MODIFY: Major rewrite for new flow
│               ├── commit-to-production.ts     # MODIFY: Auto-commit, per-row status
│               └── staging-cleanup.ts          # CREATE: Scheduled cleanup job
│
apps/
├── api/
│   ├── src/
│   │   ├── trpc/routers/bulk/
│   │   │   ├── import.ts                       # MODIFY: Add mode, exportCorrections, dismiss
│   │   │   ├── staging.ts                      # MODIFY: Update for new structure
│   │   │   └── values.ts                       # MODIFY: Simplify (auto-create removes most)
│   │   ├── schemas/
│   │   │   └── bulk.ts                         # MODIFY: New schemas for mode, corrections
│   │   └── lib/
│   │       └── csv-parser.ts                   # DELETE: Moved to jobs package
│   └── public/templates/
│       ├── avelero-bulk-import-template.xlsx   # MODIFY: Update to new column structure
│       ├── product-import-template.csv         # DELETE: CSV no longer supported
│       └── README.md                           # MODIFY: Update documentation
│
└── app/
    └── src/
        ├── components/import/
        │   ├── import-modal.tsx                # CREATE: New modal with recent imports
        │   ├── recent-imports-section.tsx      # CREATE: Recent imports list
        │   ├── mode-selector.tsx               # CREATE: Create/Enrich toggle
        │   ├── import-review-dialog.tsx        # DELETE: No longer needed
        │   ├── unmapped-values-section.tsx     # DELETE: Auto-create removes need
        │   ├── unmapped-batch-progress-modal.tsx # DELETE: No longer needed
        │   └── entity-value-combobox.tsx       # DELETE: No longer needed
        └── contexts/
            └── import-progress-context.tsx     # MODIFY: Simplify for fire-and-forget
```

---

## Phase 1: Database Migrations

### Task 1.1: Modify `import_jobs` Table

**File:** `packages/db/src/schema/data/import-jobs.ts`

**Changes:**
```typescript
// ADD these columns to importJobs table definition:

mode: text("mode").notNull().default("CREATE"), // 'CREATE' | 'ENRICH'

// UPDATE status column comment to include new values:
// PENDING | PROCESSING | COMPLETED | COMPLETED_WITH_FAILURES | FAILED
// (Remove: VALIDATING, VALIDATED, COMMITTING, CANCELLED)

hasExportableFailures: boolean("has_exportable_failures").notNull().default(false),
```

**Migration SQL:**
```sql
ALTER TABLE import_jobs ADD COLUMN mode TEXT NOT NULL DEFAULT 'CREATE';
ALTER TABLE import_jobs ADD COLUMN has_exportable_failures BOOLEAN NOT NULL DEFAULT false;
-- Update existing status values if needed
UPDATE import_jobs SET status = 'COMPLETED' WHERE status = 'VALIDATED';
UPDATE import_jobs SET status = 'COMPLETED' WHERE status = 'COMMITTING';
UPDATE import_jobs SET status = 'FAILED' WHERE status = 'CANCELLED';
```

---

### Task 1.2: Modify `staging_product_variants` Table

**File:** `packages/db/src/schema/staging/staging-product-variants.ts`

**Changes:**
```typescript
// REMOVE these columns:
colorId: uuid("color_id"),  // DELETE
sizeId: uuid("size_id"),    // DELETE

// ADD these columns:
barcode: text("barcode"),
sku: text("sku"),
nameOverride: text("name_override"),
descriptionOverride: text("description_override"),
imagePathOverride: text("image_path_override"),
status: text("status").notNull().default("PENDING"), // PENDING | COMMITTED | FAILED
errors: jsonb("errors").$type<Array<{field: string; message: string}>>(),
```

**Migration SQL:**
```sql
ALTER TABLE staging_product_variants DROP COLUMN color_id;
ALTER TABLE staging_product_variants DROP COLUMN size_id;
ALTER TABLE staging_product_variants ADD COLUMN barcode TEXT;
ALTER TABLE staging_product_variants ADD COLUMN sku TEXT;
ALTER TABLE staging_product_variants ADD COLUMN name_override TEXT;
ALTER TABLE staging_product_variants ADD COLUMN description_override TEXT;
ALTER TABLE staging_product_variants ADD COLUMN image_path_override TEXT;
ALTER TABLE staging_product_variants ADD COLUMN status TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE staging_product_variants ADD COLUMN errors JSONB;
```

---

### Task 1.3: Modify `staging_products` Table

**File:** `packages/db/src/schema/staging/staging-products.ts`

**Changes:**
```typescript
// ADD these columns:
status: text("status").notNull().default("PENDING"), // PENDING | COMMITTED | FAILED
errors: jsonb("errors").$type<Array<{field: string; message: string}>>(),
```

---

### Task 1.4: Create `staging_variant_attributes` Table

**File:** `packages/db/src/schema/staging/staging-variant-attributes.ts` (NEW)

**Contents:**
```typescript
import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  pgPolicy,
  pgTable,
  uuid,
} from "drizzle-orm/pg-core";
import { importJobs } from "../data/import-jobs";
import { stagingProductVariants } from "./staging-product-variants";

export const stagingVariantAttributes = pgTable(
  "staging_variant_attributes",
  {
    stagingId: uuid("staging_id").defaultRandom().primaryKey().notNull(),
    stagingVariantId: uuid("staging_variant_id").notNull(),
    jobId: uuid("job_id").notNull(),
    attributeId: uuid("attribute_id").notNull(),
    attributeValueId: uuid("attribute_value_id").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("staging_variant_attributes_job_id_idx").using(
      "btree",
      table.jobId.asc().nullsLast()
    ),
    index("staging_variant_attributes_staging_variant_id_idx").using(
      "btree",
      table.stagingVariantId.asc().nullsLast()
    ),
    foreignKey({
      columns: [table.stagingVariantId],
      foreignColumns: [stagingProductVariants.stagingId],
      name: "staging_variant_attributes_staging_variant_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.jobId],
      foreignColumns: [importJobs.id],
      name: "staging_variant_attributes_job_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    // RLS policies similar to other staging tables
    pgPolicy("staging_variant_attributes_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
          AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_variant_attributes_insert_by_system", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("staging_variant_attributes_delete_by_system", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
          AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
  ]
);
```

---

### Task 1.5: Create `staging_product_tags` Table

**File:** `packages/db/src/schema/staging/staging-product-tags.ts` (NEW)

**Mirrors:** `product_tags` (product → tag relationship)

**Contents:**
```typescript
import { sql } from "drizzle-orm";
import { foreignKey, index, pgPolicy, pgTable, uniqueIndex, uuid, timestamp } from "drizzle-orm/pg-core";
import { importJobs } from "../data/import-jobs";
import { stagingProducts } from "./staging-products";
import { brandTags } from "../brands/brand-tags";

export const stagingProductTags = pgTable(
  "staging_product_tags",
  {
    stagingId: uuid("staging_id").defaultRandom().primaryKey().notNull(),
    stagingProductId: uuid("staging_product_id").notNull(),
    jobId: uuid("job_id").notNull(),
    tagId: uuid("tag_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [
    index("staging_product_tags_job_id_idx").on(table.jobId),
    index("staging_product_tags_staging_product_id_idx").on(table.stagingProductId),
    uniqueIndex("staging_product_tags_unique").on(table.stagingProductId, table.tagId),
    foreignKey({ columns: [table.tagId], foreignColumns: [brandTags.id] }).onUpdate("cascade").onDelete("restrict"),
    foreignKey({ columns: [table.jobId], foreignColumns: [importJobs.id] }).onUpdate("cascade").onDelete("cascade"),
    foreignKey({ columns: [table.stagingProductId], foreignColumns: [stagingProducts.stagingId] }).onUpdate("cascade").onDelete("cascade"),
    // RLS policies...
  ]
);
```

---

### Task 1.6: Create `staging_product_weight` Table

**File:** `packages/db/src/schema/staging/staging-product-weight.ts` (NEW)

**Mirrors:** `product_weight` (1:1 with product)

**Contents:**
```typescript
import { sql } from "drizzle-orm";
import { foreignKey, numeric, pgPolicy, pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { importJobs } from "../data/import-jobs";
import { stagingProducts } from "./staging-products";

export const stagingProductWeight = pgTable(
  "staging_product_weight",
  {
    stagingProductId: uuid("staging_product_id").primaryKey().notNull(),
    jobId: uuid("job_id").notNull(),
    weight: numeric("weight", { precision: 10, scale: 2 }),
    weightUnit: text("weight_unit"), // 'g' | 'kg' | 'oz' | 'lb'
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({ columns: [table.jobId], foreignColumns: [importJobs.id] }).onUpdate("cascade").onDelete("cascade"),
    foreignKey({ columns: [table.stagingProductId], foreignColumns: [stagingProducts.stagingId] }).onUpdate("cascade").onDelete("cascade"),
    // RLS policies...
  ]
);
```

---

### Task 1.7: Create `staging_variant_materials` Table

**File:** `packages/db/src/schema/staging/staging-variant-materials.ts` (NEW)

**Mirrors:** `variant_materials` (variant-level material overrides)

**Contents:**
```typescript
import { sql } from "drizzle-orm";
import { foreignKey, index, numeric, pgPolicy, pgTable, uniqueIndex, uuid, timestamp } from "drizzle-orm/pg-core";
import { importJobs } from "../data/import-jobs";
import { stagingProductVariants } from "./staging-product-variants";
import { brandMaterials } from "../catalog/brand-materials";

export const stagingVariantMaterials = pgTable(
  "staging_variant_materials",
  {
    stagingId: uuid("staging_id").defaultRandom().primaryKey().notNull(),
    stagingVariantId: uuid("staging_variant_id").notNull(),
    jobId: uuid("job_id").notNull(),
    brandMaterialId: uuid("brand_material_id").notNull(),
    percentage: numeric("percentage", { precision: 6, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [
    index("staging_variant_materials_job_id_idx").on(table.jobId),
    index("staging_variant_materials_staging_variant_id_idx").on(table.stagingVariantId),
    uniqueIndex("staging_variant_materials_unique").on(table.stagingVariantId, table.brandMaterialId),
    foreignKey({ columns: [table.brandMaterialId], foreignColumns: [brandMaterials.id] }).onUpdate("cascade").onDelete("restrict"),
    foreignKey({ columns: [table.jobId], foreignColumns: [importJobs.id] }).onUpdate("cascade").onDelete("cascade"),
    foreignKey({ columns: [table.stagingVariantId], foreignColumns: [stagingProductVariants.stagingId] }).onUpdate("cascade").onDelete("cascade"),
    // RLS policies...
  ]
);
```

---

### Task 1.8: Create `staging_variant_eco_claims` Table

**File:** `packages/db/src/schema/staging/staging-variant-eco-claims.ts` (NEW)

**Mirrors:** `variant_eco_claims`

**Contents:**
```typescript
import { sql } from "drizzle-orm";
import { foreignKey, index, pgPolicy, pgTable, uniqueIndex, uuid, timestamp } from "drizzle-orm/pg-core";
import { importJobs } from "../data/import-jobs";
import { stagingProductVariants } from "./staging-product-variants";
import { brandEcoClaims } from "../catalog/brand-eco-claims";

export const stagingVariantEcoClaims = pgTable(
  "staging_variant_eco_claims",
  {
    stagingId: uuid("staging_id").defaultRandom().primaryKey().notNull(),
    stagingVariantId: uuid("staging_variant_id").notNull(),
    jobId: uuid("job_id").notNull(),
    ecoClaimId: uuid("eco_claim_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [
    index("staging_variant_eco_claims_job_id_idx").on(table.jobId),
    index("staging_variant_eco_claims_staging_variant_id_idx").on(table.stagingVariantId),
    uniqueIndex("staging_variant_eco_claims_unique").on(table.stagingVariantId, table.ecoClaimId),
    foreignKey({ columns: [table.ecoClaimId], foreignColumns: [brandEcoClaims.id] }).onUpdate("cascade").onDelete("restrict"),
    foreignKey({ columns: [table.jobId], foreignColumns: [importJobs.id] }).onUpdate("cascade").onDelete("cascade"),
    foreignKey({ columns: [table.stagingVariantId], foreignColumns: [stagingProductVariants.stagingId] }).onUpdate("cascade").onDelete("cascade"),
    // RLS policies...
  ]
);
```

---

### Task 1.9: Create `staging_variant_environment` Table

**File:** `packages/db/src/schema/staging/staging-variant-environment.ts` (NEW)

**Mirrors:** `variant_environment` (1:1 with variant)

**Contents:**
```typescript
import { sql } from "drizzle-orm";
import { foreignKey, numeric, pgPolicy, pgTable, uuid, timestamp } from "drizzle-orm/pg-core";
import { importJobs } from "../data/import-jobs";
import { stagingProductVariants } from "./staging-product-variants";

export const stagingVariantEnvironment = pgTable(
  "staging_variant_environment",
  {
    stagingVariantId: uuid("staging_variant_id").primaryKey().notNull(),
    jobId: uuid("job_id").notNull(),
    carbonKgCo2e: numeric("carbon_kg_co2e", { precision: 12, scale: 4 }),
    waterLiters: numeric("water_liters", { precision: 12, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({ columns: [table.jobId], foreignColumns: [importJobs.id] }).onUpdate("cascade").onDelete("cascade"),
    foreignKey({ columns: [table.stagingVariantId], foreignColumns: [stagingProductVariants.stagingId] }).onUpdate("cascade").onDelete("cascade"),
    // RLS policies...
  ]
);
```

---

### Task 1.10: Create `staging_variant_journey_steps` Table

**File:** `packages/db/src/schema/staging/staging-variant-journey-steps.ts` (NEW)

**Mirrors:** `variant_journey_steps`

**Contents:**
```typescript
import { sql } from "drizzle-orm";
import { foreignKey, index, integer, pgPolicy, pgTable, text, uniqueIndex, uuid, timestamp } from "drizzle-orm/pg-core";
import { importJobs } from "../data/import-jobs";
import { stagingProductVariants } from "./staging-product-variants";
import { brandFacilities } from "../catalog/brand-facilities";

export const stagingVariantJourneySteps = pgTable(
  "staging_variant_journey_steps",
  {
    stagingId: uuid("staging_id").defaultRandom().primaryKey().notNull(),
    stagingVariantId: uuid("staging_variant_id").notNull(),
    jobId: uuid("job_id").notNull(),
    sortIndex: integer("sort_index").notNull(),
    stepType: text("step_type").notNull(), // raw-material, weaving, dyeing-printing, etc.
    facilityId: uuid("facility_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [
    index("staging_variant_journey_steps_job_id_idx").on(table.jobId),
    index("staging_variant_journey_steps_staging_variant_id_idx").on(table.stagingVariantId),
    uniqueIndex("staging_variant_journey_steps_unique").on(table.stagingVariantId, table.sortIndex),
    foreignKey({ columns: [table.facilityId], foreignColumns: [brandFacilities.id] }).onUpdate("cascade").onDelete("restrict"),
    foreignKey({ columns: [table.jobId], foreignColumns: [importJobs.id] }).onUpdate("cascade").onDelete("cascade"),
    foreignKey({ columns: [table.stagingVariantId], foreignColumns: [stagingProductVariants.stagingId] }).onUpdate("cascade").onDelete("cascade"),
    // RLS policies...
  ]
);
```

---

### Task 1.11: Create `staging_variant_weight` Table

**File:** `packages/db/src/schema/staging/staging-variant-weight.ts` (NEW)

**Mirrors:** `variant_weight` (1:1 with variant)

**Contents:**
```typescript
import { sql } from "drizzle-orm";
import { foreignKey, numeric, pgPolicy, pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { importJobs } from "../data/import-jobs";
import { stagingProductVariants } from "./staging-product-variants";

export const stagingVariantWeight = pgTable(
  "staging_variant_weight",
  {
    stagingVariantId: uuid("staging_variant_id").primaryKey().notNull(),
    jobId: uuid("job_id").notNull(),
    weight: numeric("weight", { precision: 10, scale: 2 }),
    weightUnit: text("weight_unit"), // 'g' | 'kg' | 'oz' | 'lb'
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({ columns: [table.jobId], foreignColumns: [importJobs.id] }).onUpdate("cascade").onDelete("cascade"),
    foreignKey({ columns: [table.stagingVariantId], foreignColumns: [stagingProductVariants.stagingId] }).onUpdate("cascade").onDelete("cascade"),
    // RLS policies...
  ]
);
```

---

### Task 1.12: Update Schema Index

**File:** `packages/db/src/schema/index.ts`

**Changes:**
```typescript
// ADD exports for all new staging tables:
export * from "./staging/staging-variant-attributes";
export * from "./staging/staging-product-tags";
export * from "./staging/staging-product-weight";
export * from "./staging/staging-variant-materials";
export * from "./staging/staging-variant-eco-claims";
export * from "./staging/staging-variant-environment";
export * from "./staging/staging-variant-journey-steps";
export * from "./staging/staging-variant-weight";
```

---

## Staging Tables Summary

This table shows the complete mapping between production and staging tables:

| Production Table | Staging Table | Level | Status |
|-----------------|---------------|-------|--------|
| `products` | `staging_products` | Product | EXISTS (modify) |
| `product_variants` | `staging_product_variants` | Variant | EXISTS (modify) |
| `product_variant_attributes` | `staging_variant_attributes` | Variant | **CREATE** |
| `product_tags` | `staging_product_tags` | Product | **CREATE** |
| `product_weight` | `staging_product_weight` | Product | **CREATE** |
| `product_materials` | `staging_product_materials` | Product | EXISTS |
| `product_journey_steps` | `staging_product_journey_steps` | Product | EXISTS |
| `product_environment` | `staging_product_environment` | Product | EXISTS |
| `product_eco_claims` | `staging_product_eco_claims` | Product | EXISTS |
| `variant_materials` | `staging_variant_materials` | Variant | **CREATE** |
| `variant_eco_claims` | `staging_variant_eco_claims` | Variant | **CREATE** |
| `variant_environment` | `staging_variant_environment` | Variant | **CREATE** |
| `variant_journey_steps` | `staging_variant_journey_steps` | Variant | **CREATE** |
| `variant_weight` | `staging_variant_weight` | Variant | **CREATE** |
| `product_commercial` | N/A | Product | Not imported |
| `variant_commercial` | N/A | Variant | Not imported |

### Key Design Decision: Product vs Variant Level Data

The import logic determines where data goes based on the Excel row structure:

1. **Product-level data** (from parent row only):
   - Goes into `staging_product_*` tables
   - Applies to ALL variants unless overridden

2. **Variant-level overrides** (from any row with environmental/materials data):
   - Goes into `staging_variant_*` tables
   - Completely replaces product-level data for that specific variant
   - Per the refactor plan: "When ANY rows exist for a variant, they replace (not merge with) product-level data"

---

## Phase 2: API/Backend Changes

### Task 2.1: Update Bulk Import Schemas

**File:** `apps/api/src/schemas/bulk.ts`

**Changes:**
```typescript
// ADD new schemas:

export const importModeSchema = z.enum(["CREATE", "ENRICH"]);

export const startImportSchema = z.object({
  fileId: z.string().uuid(),
  filename: z.string(),
  mode: importModeSchema, // NEW: Required mode selection
});

export const exportCorrectionsSchema = z.object({
  jobId: z.string().uuid(),
});

export const dismissFailedImportSchema = z.object({
  jobId: z.string().uuid(),
});

export const getRecentImportsSchema = z.object({
  limit: z.number().int().min(1).max(10).default(5),
});

// REMOVE or deprecate these schemas (no longer needed with auto-create):
// - defineValueSchema
// - batchDefineSchema
// - mapToExistingSchema
// - entityTypeSchema (simplify to just CATEGORY for errors)
```

---

### Task 2.2: Update Import Router

**File:** `apps/api/src/trpc/routers/bulk/import.ts`

**Changes:**

```typescript
// MODIFY start procedure:
start: protectedProcedure
  .input(startImportSchema) // Now includes mode
  .mutation(async ({ ctx, input }) => {
    const job = await createImportJob(ctx.db, {
      brandId: ctx.brandId,
      filename: input.filename,
      mode: input.mode, // NEW: Store mode
    });
    
    await triggerValidateAndStageJob(job.id, input.fileId, input.mode);
    return { jobId: job.id };
  }),

// REMOVE approve procedure (no longer needed - fire-and-forget)

// REMOVE cancel procedure (replaced by dismiss)

// ADD exportCorrections procedure:
exportCorrections: protectedProcedure
  .input(exportCorrectionsSchema)
  .mutation(async ({ ctx, input }) => {
    // Generate Excel file with red cell highlighting
    const excelBuffer = await generateCorrectionExcel(ctx.db, input.jobId);
    
    // Upload to Supabase storage
    const { path } = await uploadCorrectionFile(excelBuffer, input.jobId);
    
    return { downloadUrl: getSignedUrl(path) };
  }),

// ADD dismiss procedure:
dismiss: protectedProcedure
  .input(dismissFailedImportSchema)
  .mutation(async ({ ctx, input }) => {
    // Delete staging data and update job
    await cleanupStagingData(ctx.db, input.jobId);
    await updateJobStatus(ctx.db, input.jobId, "DISMISSED");
    return { success: true };
  }),

// ADD getRecentImports procedure:
getRecentImports: protectedProcedure
  .input(getRecentImportsSchema)
  .query(async ({ ctx, input }) => {
    return await getRecentImportJobs(ctx.db, ctx.brandId, input.limit);
  }),
```

---

### Task 2.3: Simplify Values Router

**File:** `apps/api/src/trpc/routers/bulk/values.ts`

**Changes:**
- REMOVE `define` procedure (auto-create handles this)
- REMOVE `batchDefine` procedure (auto-create handles this)
- REMOVE `mapToExisting` procedure (auto-create handles this)
- KEEP `catalogData` procedure (still useful for UI)
- SIMPLIFY `unmapped` procedure to only return category errors

---

### Task 2.4: Update Staging Router

**File:** `apps/api/src/trpc/routers/bulk/staging.ts`

**Changes:**
```typescript
// MODIFY preview to include per-row status and errors:
preview: protectedProcedure
  .input(getStagingPreviewSchema)
  .query(async ({ ctx, input }) => {
    return await getStagingPreviewWithStatus(ctx.db, input.jobId, {
      page: input.page,
      pageSize: input.pageSize,
      filterByStatus: input.status, // NEW: Filter by PENDING | COMMITTED | FAILED
    });
  }),

// REMOVE export procedure (replaced by exportCorrections in import router)
```

---

## Phase 3: Background Job Changes

### Task 3.1: Create Excel Parser

**File:** `packages/jobs/src/lib/excel-parser.ts` (NEW)

**Contents (pseudocode):**
```typescript
import ExcelJS from "exceljs";

interface ParsedProduct {
  rowNumber: number;
  productHandle: string;
  name: string;
  description?: string;
  manufacturerName?: string;
  imagePath?: string;
  categoryPath?: string;
  seasonName?: string;
  tags?: string[];
  variants: ParsedVariant[];
}

interface ParsedVariant {
  rowNumber: number;
  barcode?: string;
  sku?: string;
  attributes: Array<{ name: string; value: string }>;
  // Overrides (only set if child row has value)
  nameOverride?: string;
  descriptionOverride?: string;
  imagePathOverride?: string;
  // Environmental
  carbonKg?: number;
  waterLiters?: number;
  weightGrams?: number;
  ecoClaims?: string[];
  materials?: ParsedMaterial[];
  journeySteps?: Record<string, string>; // stepSlug -> operatorName
}

export async function parseExcelFile(buffer: Buffer): Promise<ParsedProduct[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) throw new Error("No worksheet found");
  
  const headers = extractHeaders(worksheet.getRow(1));
  const products: ParsedProduct[] = [];
  let currentProduct: ParsedProduct | null = null;
  
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header
    
    const rowData = extractRowData(row, headers);
    const hasProductHandle = !!rowData["Product Handle"]?.trim();
    
    if (hasProductHandle) {
      // Parent row - start new product
      currentProduct = {
        rowNumber,
        productHandle: rowData["Product Handle"],
        name: rowData["Product Title"],
        description: rowData["Description"],
        manufacturerName: rowData["Manufacturer"],
        imagePath: rowData["Image"],
        categoryPath: rowData["Category"],
        seasonName: rowData["Season"],
        tags: parsePipeSeparated(rowData["Tags"]),
        variants: [extractVariant(rowData, rowNumber, null)],
      };
      products.push(currentProduct);
    } else {
      // Child row - add variant to current product
      if (!currentProduct) {
        throw new Error(`Row ${rowNumber}: Child row found before any parent`);
      }
      currentProduct.variants.push(
        extractVariant(rowData, rowNumber, currentProduct)
      );
    }
  });
  
  return products;
}

function extractVariant(
  rowData: Record<string, string>,
  rowNumber: number,
  parentProduct: ParsedProduct | null
): ParsedVariant {
  return {
    rowNumber,
    barcode: rowData["Barcode"],
    sku: rowData["SKU"],
    attributes: extractAttributes(rowData),
    // Only set overrides if this is a child row AND value differs from parent
    nameOverride: parentProduct && rowData["Product Title"]?.trim() 
      ? rowData["Product Title"] : undefined,
    descriptionOverride: parentProduct && rowData["Description"]?.trim()
      ? rowData["Description"] : undefined,
    imagePathOverride: parentProduct && rowData["Image"]?.trim()
      ? rowData["Image"] : undefined,
    // Environmental data
    carbonKg: parseFloat(rowData["Kilograms CO2"]) || undefined,
    waterLiters: parseFloat(rowData["Liters Water Used"]) || undefined,
    weightGrams: parseFloat(rowData["Grams Weight"]) || undefined,
    ecoClaims: parsePipeSeparated(rowData["Eco Claims"]),
    materials: parseMaterials(rowData["Materials Percentages"]),
    journeySteps: extractJourneySteps(rowData),
  };
}

function extractAttributes(rowData: Record<string, string>): Array<{name: string; value: string}> {
  const attrs: Array<{name: string; value: string}> = [];
  for (let i = 1; i <= 3; i++) {
    const name = rowData[`Attribute ${i}`]?.trim();
    const value = rowData[`Attribute Value ${i}`]?.trim();
    if (name && value) {
      attrs.push({ name, value });
    }
  }
  return attrs;
}

function extractJourneySteps(rowData: Record<string, string>): Record<string, string> {
  const steps: Record<string, string> = {};
  const stepColumns = [
    { col: "Raw Material", slug: "raw-material" },
    { col: "Weaving", slug: "weaving" },
    { col: "Dyeing/Printing", slug: "dyeing-printing" },
    { col: "Stitching", slug: "stitching" },
    { col: "Assembly", slug: "assembly" },
    { col: "Finishing", slug: "finishing" },
  ];
  for (const { col, slug } of stepColumns) {
    if (rowData[col]?.trim()) {
      steps[slug] = rowData[col];
    }
  }
  return steps;
}
```

---

### Task 3.2: Create Excel Export

**File:** `packages/jobs/src/lib/excel-export.ts` (NEW)

**Contents (pseudocode):**
```typescript
import ExcelJS from "exceljs";

interface ExportRow {
  rowNumber: number;
  data: Record<string, string>;
  errors: Array<{ field: string; message: string }>;
}

export async function generateCorrectionExcel(
  rows: ExportRow[],
  columnOrder: string[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Products");
  
  // Add headers
  worksheet.addRow(columnOrder);
  
  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };
  
  // Add data rows
  for (const row of rows) {
    const rowData = columnOrder.map(col => row.data[col] || "");
    const excelRow = worksheet.addRow(rowData);
    
    // Highlight error cells with red background
    for (const error of row.errors) {
      const colIndex = columnOrder.indexOf(error.field) + 1;
      if (colIndex > 0) {
        const cell = excelRow.getCell(colIndex);
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFE0E0" }, // Light red
        };
      }
    }
  }
  
  // Auto-fit columns
  worksheet.columns.forEach(column => {
    column.width = 20;
  });
  
  return await workbook.xlsx.writeBuffer() as Buffer;
}
```

---

### Task 3.3: Rewrite Validate-and-Stage Job

**File:** `packages/jobs/src/trigger/bulk/validate-and-stage.ts`

**Major changes:**

1. Replace CSV parsing with Excel parsing
2. Implement product_handle-based grouping
3. Add mode-specific validation (Create vs Enrich)
4. Implement auto-entity creation
5. Track per-row status and errors
6. Auto-trigger commit after validation

**Pseudocode structure:**
```typescript
export const validateAndStageTask = task({
  id: "validate-and-stage",
  maxDuration: { minutes: 30 },
  retry: { maxAttempts: 2 },
  run: async ({ jobId, fileId, mode }: ValidateAndStagePayload) => {
    await updateJobStatus(jobId, "PROCESSING");
    
    try {
      // 1. Download and parse Excel file
      const fileBuffer = await downloadFileFromSupabase(fileId);
      const products = await parseExcelFile(fileBuffer);
      
      // 2. Load brand catalog
      const catalog = await loadBrandCatalog(brandId);
      
      // 3. Validate and stage each product group
      const results = { success: 0, failed: 0 };
      
      for (const product of products) {
        const validationResult = await validateProductGroup(product, mode, catalog);
        
        if (validationResult.isValid) {
          // Auto-create entities as needed
          const resolvedEntities = await autoCreateEntities(product, catalog);
          
          // Insert to staging with PENDING status
          await insertToStaging(product, resolvedEntities, "PENDING");
          results.success++;
        } else {
          // Insert to staging with FAILED status and errors
          await insertToStaging(product, null, "FAILED", validationResult.errors);
          results.failed++;
        }
        
        emitProgress(jobId, results);
      }
      
      // 4. Auto-commit valid rows (no user confirmation)
      await commitValidRows(jobId);
      
      // 5. Update final status
      const finalStatus = results.failed > 0 
        ? "COMPLETED_WITH_FAILURES" 
        : "COMPLETED";
      
      await updateJobStatus(jobId, finalStatus, {
        hasExportableFailures: results.failed > 0,
      });
      
    } catch (error) {
      await updateJobStatus(jobId, "FAILED", { error: error.message });
      throw error;
    }
  },
});

async function validateProductGroup(
  product: ParsedProduct,
  mode: "CREATE" | "ENRICH",
  catalog: BrandCatalog
): Promise<ValidationResult> {
  const errors: Array<{ field: string; message: string }> = [];
  
  // Check required fields
  if (!product.name?.trim()) {
    errors.push({ field: "Product Title", message: "Required" });
  }
  
  // Check at least one variant identifier
  for (const variant of product.variants) {
    if (!variant.barcode && !variant.sku) {
      errors.push({ 
        field: "Barcode", 
        message: `Row ${variant.rowNumber}: Barcode or SKU required` 
      });
    }
  }
  
  // Mode-specific validation
  if (mode === "ENRICH") {
    for (const variant of product.variants) {
      const exists = await findVariantByIdentifier(variant.barcode, variant.sku);
      if (!exists) {
        errors.push({
          field: "SKU",
          message: `Row ${variant.rowNumber}: Variant not found`,
        });
      }
    }
  }
  
  // Category validation (only entity that can't be auto-created)
  if (product.categoryPath) {
    const category = catalog.categories.find(
      c => c.path.toLowerCase() === product.categoryPath.toLowerCase()
    );
    if (!category) {
      errors.push({
        field: "Category",
        message: `Category "${product.categoryPath}" not found`,
      });
    }
  }
  
  return { isValid: errors.length === 0, errors };
}

async function autoCreateEntities(
  product: ParsedProduct,
  catalog: BrandCatalog
): Promise<ResolvedEntities> {
  const resolved: ResolvedEntities = {};
  
  // Auto-create manufacturer if needed
  if (product.manufacturerName) {
    resolved.manufacturerId = await findOrCreateEntity(
      "brand_manufacturers",
      product.manufacturerName,
      catalog
    );
  }
  
  // Auto-create season if needed
  if (product.seasonName) {
    resolved.seasonId = await findOrCreateEntity(
      "brand_seasons",
      product.seasonName,
      catalog
    );
  }
  
  // Auto-create tags
  resolved.tagIds = [];
  for (const tagName of product.tags || []) {
    const tagId = await findOrCreateEntity("brand_tags", tagName, catalog);
    resolved.tagIds.push(tagId);
  }
  
  // Auto-create attributes and values for each variant
  for (const variant of product.variants) {
    variant.resolvedAttributes = [];
    for (const attr of variant.attributes) {
      const attributeId = await findOrCreateEntity(
        "brand_attributes",
        attr.name,
        catalog
      );
      const valueId = await findOrCreateAttributeValue(
        attributeId,
        attr.value,
        catalog
      );
      variant.resolvedAttributes.push({ attributeId, valueId });
    }
  }
  
  // Auto-create facilities for journey steps
  // Auto-create materials
  // Auto-create eco claims
  // ... similar pattern for all entities
  
  return resolved;
}
```

---

### Task 3.4: Update Commit-to-Production Job

**File:** `packages/jobs/src/trigger/bulk/commit-to-production.ts`

**Changes:**
- Called automatically after validation (not by user trigger)
- Process only rows with status = PENDING
- Update each row to COMMITTED or keep as FAILED
- Clean up COMMITTED rows from staging
- Keep FAILED rows for correction export

---

### Task 3.5: Create Staging Cleanup Job

**File:** `packages/jobs/src/trigger/bulk/staging-cleanup.ts` (NEW)

**Contents:**
```typescript
import { schedules } from "@trigger.dev/sdk/v3";

export const stagingCleanupTask = schedules.task({
  id: "staging-cleanup",
  cron: "0 3 * * *", // Run daily at 3 AM
  run: async () => {
    // Delete staging data for jobs older than 30 days
    await cleanupOldStagingData(30);
    
    // Delete staging data for dismissed jobs immediately
    await cleanupDismissedJobs();
  },
});
```

---

## Phase 4: UI Changes

### Task 4.1: Create Import Modal

**File:** `apps/app/src/components/import/import-modal.tsx` (NEW)

**Structure:**
```tsx
export function ImportModal({ open, onOpenChange }: ImportModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Products</DialogTitle>
        </DialogHeader>
        
        {/* Recent Imports Section */}
        <RecentImportsSection />
        
        <Separator />
        
        {/* New Import Section */}
        <div className="space-y-4">
          <h3 className="font-medium">Start New Import</h3>
          
          <div className="flex gap-4">
            <Button variant="outline" onClick={handleIntegration}>
              <Package className="mr-2 h-4 w-4" />
              Via Integration
            </Button>
            <Button variant="outline" onClick={handleManualImport}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Manual Bulk Import
            </Button>
          </div>
          
          {showManualImport && (
            <ManualImportSection onImportStarted={handleClose} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

### Task 4.2: Create Recent Imports Section

**File:** `apps/app/src/components/import/recent-imports-section.tsx` (NEW)

**Structure:**
```tsx
export function RecentImportsSection() {
  const { data: recentImports } = trpc.bulk.import.getRecentImports.useQuery({
    limit: 5,
  });
  
  if (!recentImports?.length) return null;
  
  return (
    <div className="space-y-2">
      <h3 className="font-medium text-sm text-muted-foreground">
        Recent Imports
      </h3>
      
      {recentImports.map((job) => (
        <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-2">
            {job.status === "COMPLETED" && (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
            {job.status === "COMPLETED_WITH_FAILURES" && (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
            {job.status === "PROCESSING" && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {job.status === "FAILED" && (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
            
            <div>
              <p className="text-sm font-medium">{formatDate(job.startedAt)}</p>
              <p className="text-xs text-muted-foreground">
                {job.summary?.successfulRows} products imported
                {job.summary?.failedRows > 0 && (
                  <span className="text-amber-600">
                    , {job.summary.failedRows} failed
                  </span>
                )}
              </p>
            </div>
          </div>
          
          {job.hasExportableFailures && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => handleDownload(job.id)}>
                Download Corrections
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleDismiss(job.id)}>
                Dismiss
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

### Task 4.3: Create Mode Selector

**File:** `apps/app/src/components/import/mode-selector.tsx` (NEW)

**Structure:**
```tsx
export function ModeSelector({ 
  value, 
  onChange 
}: { 
  value: "CREATE" | "ENRICH"; 
  onChange: (mode: "CREATE" | "ENRICH") => void;
}) {
  return (
    <RadioGroup value={value} onValueChange={onChange}>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="CREATE" id="create" />
        <Label htmlFor="create" className="cursor-pointer">
          <span className="font-medium">Create Products</span>
          <p className="text-xs text-muted-foreground">
            Import new products and variants
          </p>
        </Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="ENRICH" id="enrich" />
        <Label htmlFor="enrich" className="cursor-pointer">
          <span className="font-medium">Enrich Existing</span>
          <p className="text-xs text-muted-foreground">
            Update data for products matched by SKU/Barcode
          </p>
        </Label>
      </div>
    </RadioGroup>
  );
}
```

---

### Task 4.4: Update Import Progress Context

**File:** `apps/app/src/contexts/import-progress-context.tsx`

**Changes:**
- Simplify state (remove approval-related state)
- Remove `approveImport` function
- Remove `openReviewDialog` / `closeReviewDialog`
- Keep progress polling for active imports
- Add `mode` to import state

---

## Files to Delete

| File | Reason |
|------|--------|
| `apps/api/src/lib/csv-parser.ts` | Replaced by `excel-parser.ts` in jobs package |
| `apps/api/public/templates/product-import-template.csv` | CSV no longer supported |
| `apps/app/src/components/import/import-review-dialog.tsx` | No user confirmation needed |
| `apps/app/src/components/import/unmapped-values-section.tsx` | Auto-create removes need |
| `apps/app/src/components/import/unmapped-batch-progress-modal.tsx` | Auto-create removes need |
| `apps/app/src/components/import/entity-value-combobox.tsx` | No manual entity mapping |
| `packages/jobs/src/lib/csv-parser.ts` | Replaced by excel-parser |

---

## Implementation Order

### Recommended Sequence

1. **Phase 1 (Database)** - Must be first
   - 1.1 → 1.2 → 1.3 → 1.4 → 1.5
   - Run migrations
   - Test schema changes

2. **Phase 3.1-3.2 (Parse/Export Libraries)** - Independent, can be tested in isolation
   - Create excel-parser.ts
   - Create excel-export.ts
   - Write unit tests

3. **Phase 2 (API)** - After database, before jobs
   - 2.1 → 2.2 → 2.3 → 2.4
   - Update schemas
   - Update routers
   - Test API endpoints

4. **Phase 3.3-3.5 (Background Jobs)** - Core logic
   - Rewrite validate-and-stage
   - Update commit-to-production
   - Create cleanup job
   - Integration testing

5. **Phase 4 (UI)** - Last, depends on all above
   - Create new components
   - Delete old components
   - Update context
   - E2E testing

6. **Cleanup**
   - Delete deprecated files
   - Update template
   - Update documentation

---

## Testing Checklist

### Phase 1 Tests
- [ ] Migration runs without errors
- [ ] New columns exist with correct types
- [ ] New table has correct RLS policies

### Phase 2 Tests
- [ ] `start` accepts mode parameter
- [ ] `exportCorrections` generates valid Excel
- [ ] `dismiss` cleans up staging data
- [ ] `getRecentImports` returns correct data

### Phase 3 Tests
- [ ] Excel parser correctly groups by product_handle
- [ ] Variant overrides detected correctly
- [ ] Auto-entity creation works for all entity types
- [ ] Category errors correctly flagged
- [ ] Valid rows auto-commit
- [ ] Failed rows stay in staging
- [ ] Correction export has red highlighting

### Phase 4 Tests
- [ ] Recent imports display correctly
- [ ] Mode selector works
- [ ] Download corrections triggers download
- [ ] Dismiss cleans up UI state
- [ ] Progress indicator shows during import

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing imports | Feature flag to gradually roll out |
| Data loss during migration | Backup staging tables before migration |
| Excel parsing edge cases | Comprehensive test suite with real Excel files |
| Auto-create creates duplicates | Case-insensitive matching, trim whitespace |
| Large file performance | Keep batch processing, increase timeouts if needed |
