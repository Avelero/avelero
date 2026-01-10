# Product Export Feature - Test Plan

> **Status**: Planning  
> **Created**: 2026-01-10  
> **Coverage Target**: ~50% (focused on high-value, critical path tests)

---

## Table of Contents

1. [Overview](#overview)
2. [Testing Utilities](#testing-utilities)
3. [File Tree](#file-tree)
4. [Implementation Phases](#implementation-phases)
5. [Unit Tests](#unit-tests)
6. [Integration Tests](#integration-tests)
7. [Edge Cases Summary](#edge-cases-summary)

---

## Overview

This plan outlines the test strategy for the product export feature, focusing on high-value tests that cover critical paths and edge cases. The goal is ~50% coverage with strong, meaningful tests rather than exhaustive coverage.

### Testing Priorities

1. **Excel Generation Logic** - Core formatting and data transformation
2. **Product Data Loading** - Database queries and variant override handling
3. **Selection Resolution** - Filter + selection mode combinations
4. **Export Job Lifecycle** - Status transitions and error handling
5. **Edge Cases** - Empty exports, special characters, large datasets

### Test Philosophy

Following the `packages/integrations/__tests__` patterns:
- **Unit tests**: Pure function testing without database dependencies (fast)
- **Integration tests**: Full database tests with real schema, cleanup between tests
- **Setup files**: Use `@v1/testing` utilities for consistent test setup

---

## Testing Utilities

These utilities from `@v1/testing` should be used in the export tests:

### From `@v1/testing/db`

| Utility | Purpose |
|---------|---------|
| `testDb` | Drizzle database instance connected to test PostgreSQL |
| `cleanupTables()` | Truncates all non-protected tables with CASCADE |
| `closeTestDb()` | Closes database connection after all tests |
| `createTestBrand(name?)` | Creates a test brand, returns `brandId` |
| `createTestBrandIntegration(brandId, slug?, options?)` | Creates a brand integration, returns `brandIntegrationId` |

### From `@v1/testing/context`

| Utility | Purpose |
|---------|---------|
| `createTestSyncContext(options)` | Creates SyncContext with mock storage client |
| `createFieldConfigs(overrides?)` | Creates field configs with enable/disable settings |

### Mock Storage Client

The `createTestSyncContext()` includes a mock storage client that:
- Returns fake paths for uploads: `{bucket}/{path}`
- Returns mock signed URLs: `https://mock.storage.example.com/{bucket}/{path}?signed=true`
- Does not make real network calls

---

## File Tree

```
packages/jobs/
└── __tests__/
    ├── setup.ts                                    (NEW)
    ├── unit/
    │   ├── setup.ts                                (NEW)
    │   └── excel-export/
    │       ├── formatting.test.ts                  (NEW - 8 tests)
    │       ├── parent-child-rows.test.ts           (NEW - 6 tests)
    │       └── column-mapping.test.ts              (NEW - 4 tests)
    └── integration/
        └── export/
            ├── data-loading.test.ts                (NEW - 7 tests)
            ├── variant-overrides.test.ts           (NEW - 6 tests)
            └── selection-modes.test.ts             (NEW - 5 tests)

packages/db/
└── __tests__/
    ├── setup.ts                                    (NEW)
    └── integration/
        └── queries/
            └── export-jobs.test.ts                 (NEW - 8 tests)

apps/api/
└── __tests__/
    ├── setup.ts                                    (NEW)
    └── integration/
        └── trpc/
            └── bulk-export.test.ts                 (NEW - 8 tests)

packages/testing/
└── src/
    └── db/
        └── export.ts                               (NEW - helper functions)

Total: ~52 tests across 9 test files + 1 helper file
```

---

## Implementation Phases

### Phase 1: Setup Infrastructure
**Files to create:**
- `packages/jobs/__tests__/setup.ts` - Integration test setup with DB cleanup
- `packages/jobs/__tests__/unit/setup.ts` - Minimal unit test setup (no DB)
- `packages/db/__tests__/setup.ts` - DB package test setup
- `apps/api/__tests__/setup.ts` - API test setup

**Tasks:**
- [x] Create setup files following `packages/integrations/__tests__/setup.ts` pattern
- [ ] Configure `.env.test` if not already present for each package
- [ ] Verify `bun test` runs correctly with empty test files

**Setup file template (integration):**
```typescript
// Load .env.test FIRST before any other imports
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dir, "../.env.test") });

import { beforeAll, afterAll, afterEach } from "bun:test";
import { cleanupTables, closeTestDb } from "@v1/testing/db";

beforeAll(async () => {
    await cleanupTables();
});

afterEach(async () => {
    await cleanupTables();
});

afterAll(async () => {
    await closeTestDb();
});
```

---

### Phase 2: Test Helpers
**Files to create:**
- `packages/testing/src/db/export.ts` - Export-specific test helpers

**Tasks:**
- [x] Create `createTestProductForExport()` helper
- [x] Create `createTestVariantWithOverrides()` helper
- [x] Create `createTestExportJob()` helper
- [x] Update `packages/testing/package.json` exports if needed
- [x] Update `packages/testing/src/index.ts` to re-export

**Helper functions:**
```typescript
// packages/testing/src/db/export.ts

/**
 * Creates a complete test product with all related data for export testing.
 * Returns the product ID.
 */
export async function createTestProductForExport(
    brandId: string,
    options?: {
        name?: string;
        handle?: string;
        tags?: string[];
        materials?: Array<{ name: string; percentage: number }>;
        ecoClaims?: string[];
        carbonKg?: number;
        waterLiters?: number;
        weightGrams?: number;
        journeySteps?: Record<string, string>;
        categoryPath?: string[];
        manufacturerName?: string;
        seasonName?: string;
    }
): Promise<string>;

/**
 * Creates a variant with override data for testing override resolution.
 * Returns the variant ID.
 */
export async function createTestVariantWithOverrides(
    productId: string,
    options?: {
        upid?: string;
        sku?: string;
        barcode?: string;
        attributes?: Array<{ name: string; value: string }>;
        // Overrides
        nameOverride?: string;
        carbonKgOverride?: number;
        waterLitersOverride?: number;
        weightGramsOverride?: number;
        materialsOverride?: Array<{ name: string; percentage: number }>;
        ecoClaimsOverride?: string[];
        journeyStepsOverride?: Record<string, string>;
    }
): Promise<string>;

/**
 * Creates a test export job.
 * Returns the export job ID.
 */
export async function createTestExportJob(
    brandId: string,
    userId: string,
    options?: {
        status?: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
        selectionMode?: "all" | "explicit";
        includeIds?: string[];
        excludeIds?: string[];
    }
): Promise<string>;
```

---

### Phase 3: Unit Tests (Excel Generation)
**Files to create:**
- `packages/jobs/__tests__/unit/excel-export/formatting.test.ts`
- `packages/jobs/__tests__/unit/excel-export/parent-child-rows.test.ts`
- `packages/jobs/__tests__/unit/excel-export/column-mapping.test.ts`

**Tasks:**
- [ ] Export helper functions from `excel-export-products.ts` for testing
- [ ] Write formatting tests (8 tests)
- [ ] Write parent/child row tests (6 tests)
- [ ] Write column mapping tests (4 tests)
- [ ] Run `bun test packages/jobs/__tests__/unit` to verify

---

### Phase 4: Integration Tests (Data Loading)
**Files to create:**
- `packages/jobs/__tests__/integration/export/data-loading.test.ts`
- `packages/jobs/__tests__/integration/export/variant-overrides.test.ts`
- `packages/jobs/__tests__/integration/export/selection-modes.test.ts`

**Tasks:**
- [ ] Write data loading tests (7 tests)
- [ ] Write variant override tests (6 tests)
- [ ] Write selection mode tests (5 tests)
- [ ] Run `bun test packages/jobs/__tests__/integration` to verify

---

### Phase 5: Database Query Tests
**Files to create:**
- `packages/db/__tests__/integration/queries/export-jobs.test.ts`

**Tasks:**
- [ ] Write export job CRUD tests (8 tests)
- [ ] Run `bun test packages/db/__tests__` to verify

---

### Phase 6: API Router Tests
**Files to create:**
- `apps/api/__tests__/integration/trpc/bulk-export.test.ts`

**Tasks:**
- [ ] Create mock for Trigger.dev `tasks.trigger()`
- [ ] Write TRPC router tests (8 tests)
- [ ] Run `bun test apps/api/__tests__` to verify

---

### Phase 7: Final Verification
**Tasks:**
- [ ] Run all export tests: `bun test --filter export`
- [ ] Verify no test pollution (each test isolated)
- [ ] Check test coverage report if available
- [ ] Update this plan with completion status

---

## Unit Tests

### File: `packages/jobs/__tests__/unit/excel-export/formatting.test.ts`

**Purpose**: Test pure helper functions for data formatting

| # | Test Name | Edge Case |
|---|-----------|-----------|
| 1 | `joinSemicolon() returns empty string for null array` | Null handling |
| 2 | `joinSemicolon() returns empty string for undefined array` | Undefined handling |
| 3 | `joinSemicolon() returns single item without semicolon` | Single item |
| 4 | `joinSemicolon() joins multiple items with "; " separator` | Normal case |
| 5 | `formatMaterials() returns empty strings for null materials` | Null handling |
| 6 | `formatMaterials() returns empty strings for empty array` | Empty array |
| 7 | `formatMaterials() separates names and percentages correctly` | Normal case |
| 8 | `formatMaterials() handles materials with null percentage` | Partial data |

---

### File: `packages/jobs/__tests__/unit/excel-export/parent-child-rows.test.ts`

**Purpose**: Test parent/child row structure logic

| # | Test Name | Edge Case |
|---|-----------|-----------|
| 1 | `first variant includes all product-level fields (parent row)` | Normal case |
| 2 | `subsequent variants only include variant fields (child rows)` | Multi-variant |
| 3 | `single variant product outputs only parent row` | Single variant |
| 4 | `parent row uses variant override when present` | Override priority |
| 5 | `child row omits fields when no override exists` | No override |
| 6 | `attributes sorted by sortOrder in output` | Ordering |

---

### File: `packages/jobs/__tests__/unit/excel-export/column-mapping.test.ts`

**Purpose**: Test column mapping logic

| # | Test Name | Edge Case |
|---|-----------|-----------|
| 1 | `buildColumnMapFromRow() creates correct index mapping` | Normal case |
| 2 | `getAttributeByIndex() returns correct attribute by sort order` | Normal case |
| 3 | `getAttributeByIndex() returns empty for out-of-bounds index` | Out of bounds |
| 4 | `buildColumnMapFromRow() handles whitespace in headers` | Whitespace |

---

## Integration Tests

### File: `packages/jobs/__tests__/integration/export/data-loading.test.ts`

**Purpose**: Test `getProductsForExport()` database query

**Setup**: Uses `@v1/testing/db` utilities

```typescript
import { beforeEach, afterEach, afterAll, describe, it, expect } from "bun:test";
import { cleanupTables, closeTestDb, createTestBrand, testDb } from "@v1/testing/db";
import { createTestProductForExport } from "@v1/testing/db/export";
```

| # | Test Name | Edge Case |
|---|-----------|-----------|
| 1 | `loads products with all related entities` | Normal case |
| 2 | `returns empty array for empty product IDs` | Empty input |
| 3 | `filters by brandId (cannot load other brand products)` | Security |
| 4 | `loads manufacturer and season names via joins` | Related data |
| 5 | `builds correct category path from taxonomy` | Category path |
| 6 | `loads journey steps with facility names` | Journey steps |
| 7 | `handles products with no related data` | Missing relations |

---

### File: `packages/jobs/__tests__/integration/export/variant-overrides.test.ts`

**Purpose**: Test variant override resolution

| # | Test Name | Edge Case |
|---|-----------|-----------|
| 1 | `variant without overrides uses product-level values` | No override |
| 2 | `variant with environment override includes carbonKg/waterLiters` | Env override |
| 3 | `variant with materials override includes materialsOverride array` | Materials |
| 4 | `variant with eco-claims override includes ecoClaimsOverride` | Eco-claims |
| 5 | `variant with journey override includes journeyStepsOverride` | Journey |
| 6 | `multiple variants have independent override resolution` | Multi-variant |

---

### File: `packages/jobs/__tests__/integration/export/selection-modes.test.ts`

**Purpose**: Test product ID resolution from selection

| # | Test Name | Edge Case |
|---|-----------|-----------|
| 1 | `explicit mode returns exactly specified product IDs` | Explicit mode |
| 2 | `all mode with no excludeIds returns all products` | All mode |
| 3 | `all mode with excludeIds filters out excluded products` | Exclusion |
| 4 | `filter state affects which products return in all mode` | Filters |
| 5 | `empty selection returns empty result gracefully` | Empty result |

---

### File: `packages/db/__tests__/integration/queries/export-jobs.test.ts`

**Purpose**: Test export job CRUD

**Setup**: Uses `@v1/testing/db` utilities

```typescript
import { beforeEach, afterEach, afterAll, describe, it, expect } from "bun:test";
import { cleanupTables, closeTestDb, createTestBrand, testDb } from "@v1/testing/db";
import { createExportJob, updateExportJobStatus, getExportJobStatus } from "@v1/db/queries/bulk";
```

| # | Test Name | Edge Case |
|---|-----------|-----------|
| 1 | `createExportJob() creates job with PENDING status` | Default status |
| 2 | `createExportJob() stores selection mode and IDs correctly` | Data storage |
| 3 | `updateExportJobStatus() updates only status when provided` | Partial update |
| 4 | `updateExportJobStatus() updates progress fields` | Progress |
| 5 | `updateExportJobStatus() updates completion fields` | Completion |
| 6 | `getExportJobStatus() returns null for non-existent job` | Not found |
| 7 | `getExportJobStatus() returns complete job data` | Complete data |
| 8 | `updateExportJobStatus() throws for non-existent job` | Error case |

---

### File: `apps/api/__tests__/integration/trpc/bulk-export.test.ts`

**Purpose**: Test TRPC export router

**Setup**: Needs mock for Trigger.dev

```typescript
import { beforeEach, afterEach, afterAll, describe, it, expect, mock } from "bun:test";
import { cleanupTables, closeTestDb, createTestBrand, testDb } from "@v1/testing/db";

// Mock Trigger.dev tasks
const mockTrigger = mock(() => Promise.resolve({ id: "mock-run-id" }));
mock.module("@trigger.dev/sdk/v3", () => ({
    tasks: { trigger: mockTrigger },
}));
```

| # | Test Name | Edge Case |
|---|-----------|-----------|
| 1 | `start mutation creates export job and returns jobId` | Normal case |
| 2 | `start mutation requires user email` | Validation |
| 3 | `start mutation handles Trigger.dev failure gracefully` | External failure |
| 4 | `status query returns progress with percentage` | Progress calc |
| 5 | `status query returns downloadUrl when COMPLETED` | Completion |
| 6 | `status query throws for non-existent job` | Not found |
| 7 | `status query prevents cross-brand access` | Security |
| 8 | `progress percentage rounds to integer` | Rounding |

---

## Edge Cases Summary

### Covered Edge Cases

| Category | Edge Case | Test File | Test # |
|----------|-----------|-----------|--------|
| **Null/Empty** | Null array in joinSemicolon | formatting.test.ts | 1 |
| **Null/Empty** | Undefined array in joinSemicolon | formatting.test.ts | 2 |
| **Null/Empty** | Empty product IDs array | data-loading.test.ts | 2 |
| **Null/Empty** | Empty selection result | selection-modes.test.ts | 5 |
| **Null/Empty** | Product with no related data | data-loading.test.ts | 7 |
| **Partial Data** | Material with null percentage | formatting.test.ts | 8 |
| **Partial Data** | Variant without overrides | variant-overrides.test.ts | 1 |
| **Partial Data** | Child row without override | parent-child-rows.test.ts | 5 |
| **Security** | Cross-brand product access | data-loading.test.ts | 3 |
| **Security** | Cross-brand job access | bulk-export.test.ts | 7 |
| **Validation** | Missing user email | bulk-export.test.ts | 2 |
| **Validation** | Non-existent job ID | export-jobs.test.ts | 6, 8 |
| **External Failure** | Trigger.dev failure | bulk-export.test.ts | 3 |
| **Ordering** | Attribute sort order | parent-child-rows.test.ts | 6 |
| **Single/Multi** | Single variant product | parent-child-rows.test.ts | 3 |
| **Single/Multi** | Multi-variant override isolation | variant-overrides.test.ts | 6 |
| **Boundaries** | Out-of-bounds attribute index | column-mapping.test.ts | 3 |
| **String Handling** | Whitespace in headers | column-mapping.test.ts | 4 |

### Not Tested (Out of Scope)

| Item | Reason |
|------|--------|
| Email template rendering | React Email is well-tested upstream |
| Supabase storage upload | External service, mock storage used instead |
| Frontend modal UI | Requires E2E testing framework |
| ExcelJS library internals | Third-party responsibility |
| Full Trigger.dev execution | Would need Trigger.dev test env |
| Signed URL generation | Supabase SDK responsibility |

---

## Running Tests

```bash
# Run all export-related tests
bun test --filter export

# Run unit tests only (fast)
bun test packages/jobs/__tests__/unit

# Run integration tests
bun test packages/jobs/__tests__/integration
bun test packages/db/__tests__/integration
bun test apps/api/__tests__/integration

# Run with verbose output
bun test --filter export --verbose
```

---

## Checklist

### Phase 1: Setup Infrastructure
- [x] `packages/jobs/__tests__/setup.ts`
- [x] `packages/jobs/__tests__/unit/setup.ts`
- [x] `packages/db/__tests__/setup.ts`
- [x] `apps/api/__tests__/setup.ts`

### Phase 2: Test Helpers
- [x] `packages/testing/src/db/export.ts`
- [x] Update exports in `package.json`

### Phase 3: Unit Tests
- [ ] `formatting.test.ts` (8 tests)
- [ ] `parent-child-rows.test.ts` (6 tests)
- [ ] `column-mapping.test.ts` (4 tests)

### Phase 4: Integration Tests (Jobs)
- [x] `data-loading.test.ts` (7 tests)
- [x] `variant-overrides.test.ts` (7 tests)
- [x] `selection-modes.test.ts` (7 tests)

### Phase 5: Database Tests
- [ ] `export-jobs.test.ts` (8 tests)

### Phase 6: API Tests
- [ ] `bulk-export.test.ts` (8 tests)

### Phase 7: Verification
- [ ] All tests pass
- [ ] No test pollution
- [ ] Update plan with completion
