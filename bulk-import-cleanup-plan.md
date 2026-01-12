# Bulk Import System - Code Cleanup & Optimization Plan

## Executive Summary

After analyzing the bulk import system across 6 main files (~6,000 lines), I've identified significant opportunities for cleanup and optimization. The system works correctly but has accumulated debug code, deprecated functions, duplicate logic, and overly verbose patterns from bug-fixing iterations.

**Estimated Line Reduction:** ~1,500-2,000 lines (25-33%)
**Estimated Performance Improvement:** ~15-20% (fewer allocations, consolidated queries)

---

## Table of Contents

1. [Critical Issues (Must Fix)](#1-critical-issues-must-fix)
2. [Dead/Deprecated Code](#2-deaddeprecated-code)
3. [Duplicate Logic](#3-duplicate-logic)
4. [Code Structure Issues](#4-code-structure-issues)
5. [Performance Opportunities](#5-performance-opportunities)
6. [Proposed Refactoring Plan](#6-proposed-refactoring-plan)

---

## 1. Critical Issues (Must Fix)

### 1.1 DIAGNOSTIC Logging Pollution

**File:** `validate-and-stage.ts`
**Issue:** 32 `DIAGNOSTIC` logger statements added during debugging
**Impact:** Log pollution, slight performance overhead, confusion in production logs

```typescript
// Examples found:
logger.info("DIAGNOSTIC: Before staging insert", {...});
logger.info("DIAGNOSTIC: Staging insert successful", {...});
logger.error("DIAGNOSTIC: Staging insert FAILED", {...});
// ... 29 more
```

**Fix:** Remove all DIAGNOSTIC logging or convert critical ones to proper debug-level logs.

---

### 1.2 Unused Database Function

**File:** `packages/db/src/queries/bulk/staging/insert.ts` (lines 281-372)
**Issue:** `batchInsertStagingWithStatus()` - 90 lines of code that is NEVER called
**Impact:** Dead code, maintenance burden

```typescript
// Defined but never imported or used anywhere:
export async function batchInsertStagingWithStatus(...)
```

**Fix:** Delete this function entirely.

---

## 2. Dead/Deprecated Code

### 2.1 Deprecated Functions Still Exported

**File:** `excel-export.ts`

| Function | Lines | Status |
|----------|-------|--------|
| `generateFullCorrectionExcel` | 15 | Marked @deprecated, not used |
| `generateImportTemplate` | 90 | Not used in production (template is static file) |
| `DEFAULT_IMPORT_COLUMN_ORDER` | 30 | Only used in tests |

**File:** `excel-parser.ts`

| Function | Lines | Status |
|----------|-------|--------|
| `parsePipeSeparated` | 4 | Just wraps `parseSemicolonSeparated` |
| `validateRequiredColumns` | 7 | Just wraps `validateTemplateMatch` |

**Total:** ~146 lines of dead code

**Fix:** Delete deprecated functions. Update tests to use non-deprecated alternatives.

---

### 2.2 Unused Type Definitions

**File:** `packages/db/src/queries/bulk/staging/types.ts`

- `StagingProductPreview` - Uses `productUpid` field that doesn't exist in current staging workflow
- `InsertStagingProductParams.productUpid` - Legacy field, no longer used

**Fix:** Audit and remove legacy fields from types.

---

## 3. Duplicate Logic

### 3.1 Column Name Mappings (Two Inverse Mappings)

**Problem:** Two files have the same knowledge represented differently:

**File 1:** `excel-parser.ts` - Maps template → internal names
```typescript
const COLUMN_TO_INTERNAL: Record<string, string> = {
  "kgCO2e Carbon Footprint": "Kilograms CO2",
  "Eco-claims": "Eco Claims",
  // ... 30+ mappings
};
```

**File 2:** `generate-error-report.ts` - Maps internal → template names
```typescript
function getTemplateColumnName(internalName: string): string {
  const columnMappings: Record<string, string> = {
    "Kilograms CO2": "kgCO2e Carbon Footprint",
    "Eco Claims": "Eco-claims",
    // ... 30+ mappings (inverse of above)
  };
}
```

**Fix:** Create single source of truth in a shared constants file:

```typescript
// packages/jobs/src/lib/column-mappings.ts
export const TEMPLATE_TO_INTERNAL = {
  "kgCO2e Carbon Footprint": "Kilograms CO2",
  // ...
} as const;

export const INTERNAL_TO_TEMPLATE = Object.fromEntries(
  Object.entries(TEMPLATE_TO_INTERNAL).map(([k, v]) => [v, k])
);
```

---

### 3.2 Job Status Mapping (Repeated 5 Times)

**File:** `packages/db/src/queries/bulk/import/jobs.ts`

The same object mapping is repeated in every function:

```typescript
// Repeated in: createImportJob, updateImportJobStatus, updateImportJobProgress,
// getImportJobStatus, getRecentImportJobs
return {
  id: job.id,
  brandId: job.brandId,
  filename: job.filename,
  startedAt: job.startedAt,
  finishedAt: job.finishedAt,
  commitStartedAt: job.commitStartedAt,
  status: job.status,
  requiresValueApproval: job.requiresValueApproval,
  summary: job.summary as Record<string, unknown> | null,
  mode: job.mode,
  hasExportableFailures: job.hasExportableFailures,
  correctionFilePath: job.correctionFilePath,
  correctionDownloadUrl: job.correctionDownloadUrl,
  correctionExpiresAt: job.correctionExpiresAt,
  userId: job.userId,
  userEmail: job.userEmail,
};
```

**Fix:** Extract to helper function:

```typescript
function mapJobToStatus(job: typeof importJobs.$inferSelect): ImportJobStatus {
  return {
    id: job.id,
    // ...
  };
}
```

**Savings:** ~60 lines

---

### 3.3 Error Handling Pattern (14 Near-Identical Blocks)

**File:** `validate-and-stage.ts` - `batchInsertStagingData()` function

Each insert has the same try/catch pattern:

```typescript
// Repeated 14 times with minor variations:
if (pendingOps.productTags.length > 0) {
  try {
    await database.insert(stagingProductTags).values(pendingOps.productTags);
    logger.info("DIAGNOSTIC: Inserted productTags", { count: pendingOps.productTags.length });
  } catch (error) {
    logger.error("DIAGNOSTIC: productTags insert FAILED", {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorCode: (error as { code?: string })?.code,
      errorDetail: (error as { detail?: string })?.detail,
      count: pendingOps.productTags.length,
    });
    throw error;
  }
}
```

**Fix:** Create generic insert helper:

```typescript
async function safeInsert<T>(
  db: Database,
  table: PgTable,
  values: T[],
  tableName: string
): Promise<void> {
  if (values.length === 0) return;
  await db.insert(table).values(values);
}
```

**Savings:** ~200 lines

---

## 4. Code Structure Issues

### 4.1 Monolithic Functions

| Function | File | Lines | Issue |
|----------|------|-------|-------|
| `computeProductStagingOps` | validate-and-stage.ts | ~540 | Single function handles all validation + staging logic |
| `computeProductionOps` | commit-to-production.ts | ~260 | Single function handles all production ops computation |
| `batchInsertStagingData` | validate-and-stage.ts | ~330 | 14 insert operations in one function |
| `batchExecuteProductionOps` | commit-to-production.ts | ~240 | 17 operations in one function |

**Fix:** Break into smaller, focused functions:

```typescript
// Instead of one huge computeProductStagingOps:
const productErrors = validateProduct(product, catalog);
const variantOps = buildVariantOps(product, catalog, preFetched);
const relationOps = buildRelationOps(product, catalog);
```

---

### 4.2 Type Definitions Scattered

**Issue:** `RowError` interface defined inline in multiple files:

- `validate-and-stage.ts` line 52
- `generate-error-report.ts` implicit in Map typing
- `packages/db/src/queries/bulk/staging/types.ts` line 60

**Fix:** Single shared type definition:

```typescript
// packages/jobs/src/lib/types.ts
export interface RowError {
  field: string;
  message: string;
}
```

---

### 4.3 Constants Not Centralized

Journey step columns defined in multiple places:
- `excel-parser.ts` - `JOURNEY_STEP_COLUMNS`
- Template files
- generate-error-report.ts mappings

**Fix:** Single constants file for all column/field definitions.

---

## 5. Performance Opportunities

### 5.1 Custom Concurrency Management

**File:** `commit-to-production.ts` - `processImages()`

~80 lines implementing custom concurrency for image uploads:

```typescript
await new Promise<void>((resolve) => {
  const processNext = async () => {
    if (currentIndex >= tasks.length) {
      if (completed + failed === tasks.length) {
        resolve();
      }
      return;
    }
    // ... custom queue implementation
  };
  // ...
});
```

**Fix:** Use `p-limit` library (3 lines):

```typescript
import pLimit from 'p-limit';
const limit = pLimit(IMAGE_CONCURRENCY);
await Promise.all(tasks.map(task => limit(() => processImage(task))));
```

**Savings:** ~70 lines

---

### 5.2 Repeated Map Lookups

**File:** `validate-and-stage.ts`

Multiple calls to `catalog.X.get(normalizeKey(value))` for same values:

```typescript
const manufacturerId = product.manufacturerName
  ? catalog.manufacturers.get(normalizeKey(product.manufacturerName)) ?? null
  : null;
```

**Fix:** Pre-normalize values once at the start of product processing.

---

### 5.3 Object Spread in Loops

```typescript
for (const product of batchData) {
  // This creates new object every iteration
  return batch.map((product) => ({
    ...product,
    variants: variantsByProduct.get(product.stagingId) || [],
    tags: tagsByProduct.get(product.stagingId) || [],
    // ... more spreads
  }));
}
```

**Fix:** Direct property assignment where possible.

---

## 6. Proposed Refactoring Plan

### Phase 1: Quick Wins (Low Risk, High Impact)

| Task | Lines Saved | Risk | Time |
|------|-------------|------|------|
| Remove DIAGNOSTIC logging | 100+ | Very Low | 30min |
| Delete `batchInsertStagingWithStatus` | 90 | Very Low | 10min |
| Delete deprecated functions | 146 | Low | 30min |
| Extract job status mapping helper | 60 | Low | 20min |

**Total Phase 1:** ~400 lines, ~1.5 hours

### Phase 2: Consolidation (Medium Risk)

| Task | Lines Saved | Risk | Time |
|------|-------------|------|------|
| Create shared column mappings | 60 | Low | 1hr |
| Create shared types file | 30 | Low | 30min |
| Simplify error handling pattern | 200 | Medium | 1hr |
| Replace custom concurrency with p-limit | 70 | Medium | 30min |

**Total Phase 2:** ~360 lines, ~3 hours

### Phase 3: Structural Improvements (Higher Risk)

| Task | Lines Saved | Risk | Time |
|------|-------------|------|------|
| Break down `computeProductStagingOps` | 100+ | Medium | 2hr |
| Break down `batchInsertStagingData` | 100+ | Medium | 1.5hr |
| Break down `computeProductionOps` | 50+ | Medium | 1hr |
| Consolidate constants | 50+ | Low | 1hr |

**Total Phase 3:** ~300+ lines, ~5.5 hours

---

## Summary of Files to Modify

| File | Current Lines | Estimated After | Reduction |
|------|---------------|-----------------|-----------|
| validate-and-stage.ts | 2,128 | ~1,600 | 25% |
| commit-to-production.ts | 1,633 | ~1,300 | 20% |
| generate-error-report.ts | 540 | ~450 | 17% |
| excel-export.ts | 440 | ~300 | 32% |
| excel-parser.ts | 816 | ~750 | 8% |
| staging/insert.ts | 380 | ~290 | 24% |
| import/jobs.ts | 264 | ~200 | 24% |

**Grand Total Reduction:** ~1,500 lines (25%)

---

## New Files to Create

1. `packages/jobs/src/lib/column-mappings.ts` - Centralized column name mappings
2. `packages/jobs/src/lib/types.ts` - Shared type definitions (RowError, etc.)
3. `packages/jobs/src/lib/db-helpers.ts` - Generic insert/update helpers

---

## Files to Delete (After Migration)

1. Remove deprecated exports from `excel-export.ts`
2. Remove `batchInsertStagingWithStatus` from `staging/insert.ts`

---

## Testing Requirements

After each phase:
1. Run existing test suite
2. Manually test import with:
   - Valid file (all products succeed)
   - Invalid file (mix of blocked/warnings)
   - Large file (250+ products to test batching)
3. Verify error report generation
4. Verify email notifications
