# Bulk Import Testing Plan

This document provides a comprehensive testing plan for the bulk import functionality, modeled after the integrations package testing architecture.

## Table of Contents

1. [Overview](#overview)
2. [Testing Architecture](#testing-architecture)
3. [Unit Tests](#unit-tests)
4. [Integration Tests](#integration-tests)
5. [File Tree Structure](#file-tree-structure)
6. [Testing Utilities](#testing-utilities)
7. [Phased Implementation Plan](#phased-implementation-plan)

---

## Overview

### Test Summary

| Category | Test Files | Test Cases |
|----------|------------|------------|
| Unit Tests | 8 | 53 |
| Integration Tests | 17 | 96 |
| **Total** | **25** | **149** |

### Key Testing Principles

- **Bun test framework** - Same as integrations package
- **MSW (Mock Service Worker)** - For external API mocking
- **Test fixtures** - Reusable Excel files and data
- **Database isolation** - Each test uses clean database state
- **Parallel-safe** - Tests don't interfere with each other

---

## Testing Architecture

### Framework & Tools

```
Bun Test Framework
├── describe() / it() / expect()
├── beforeAll() / afterAll() / beforeEach() / afterEach()
├── test.todo() for pending tests
└── Mock utilities (mock, spyOn)

MSW (Mock Service Worker)
├── HTTP request interception
├── Response mocking
└── Network error simulation

ExcelJS
├── Create test Excel files programmatically
├── Validate generated Excel output
└── Test various Excel formats
```

### Test Organization

```
packages/jobs/__tests__/
├── unit/           # Pure function tests, no database
├── integration/    # Full flow tests with database
├── fixtures/       # Test data and Excel files
└── setup.ts        # Global test setup
```

---

## Unit Tests

### 1. Excel Parser - Row Grouping

**File:** `unit/excel-parser/row-grouping.test.ts`

Tests the Shopify-style row grouping logic where Product Handle determines parent/child relationships.

| Test Name | Description | Edge Case |
|-----------|-------------|-----------|
| `groups rows by Product Handle` | Rows with same handle become one product | Basic functionality |
| `first row with handle becomes parent` | First occurrence defines product | Order matters |
| `rows without handle are children` | Empty handle = child of previous product | Child detection |
| `handles whitespace in Product Handle` | Trims spaces from handles | `" handle "` -> `"handle"` |
| `handles case sensitivity in handles` | Case-sensitive grouping | `"Handle"` vs `"handle"` |
| `single row becomes single-variant product` | One row = one product, one variant | Minimum data |
| `empty file returns empty array` | No data rows | Empty input |
| `header-only file returns empty array` | Only headers, no data | Header-only |
| `preserves row order within groups` | Children maintain original order | Order preservation |

### 2. Excel Parser - Product-Level vs Variant-Level Data

**File:** `unit/excel-parser/data-levels.test.ts`

Tests the separation of product-level and variant-level data.

| Test Name | Description | Edge Case |
|-----------|-------------|-----------|
| `extracts product-level fields from parent row` | Title, Handle, Manufacturer, Description, Category, Season, Tags, Image | Parent extraction |
| `extracts variant-level fields from all rows` | SKU, Barcode, Attributes, Grams Weight | Variant extraction |
| `extracts environmental data from parent row only` | Kilograms CO2, Liters Water Used, Carbon Footprint | Product-level env |
| `extracts materials from parent row only` | Materials Percentages parsed at product level | Product-level materials |
| `extracts journey steps from parent row only` | Raw Material through Finishing | Product-level journey |
| `handles variant-level overrides in child rows` | Child can override Title, Description, Image | Override support |
| `ignores product-level fields in child rows (except overrides)` | Category, Season, Manufacturer ignored in children | Child filtering |
| `eco claims extracted from parent row` | Eco Claims semicolon-separated | Product-level eco |

### 3. Excel Parser - Semicolon-Separated Values

**File:** `unit/excel-parser/semicolon-parsing.test.ts`

Tests parsing of semicolon-separated fields (Tags, Eco Claims, Materials).

| Test Name | Description | Edge Case |
|-----------|-------------|-----------|
| `parses single value` | `"tag1"` -> `["tag1"]` | Single item |
| `parses multiple values` | `"tag1;tag2;tag3"` -> `["tag1","tag2","tag3"]` | Multiple items |
| `trims whitespace around values` | `" tag1 ; tag2 "` -> `["tag1","tag2"]` | Whitespace handling |
| `handles empty string` | `""` -> `[]` | Empty input |
| `filters out empty values` | `"tag1;;tag2"` -> `["tag1","tag2"]` | Empty between |
| `handles leading/trailing semicolons` | `";tag1;tag2;"` -> `["tag1","tag2"]` | Extra semicolons |
| `preserves special characters` | `"tag;with:colon"` -> `["tag","with:colon"]` | Special chars |

### 4. Excel Parser - Materials Parsing

**File:** `unit/excel-parser/materials-parsing.test.ts`

Tests the complex materials format: `Name:Percentage:Country:Certified:CertName:CertId:CertExpiry`

| Test Name | Description | Edge Case |
|-----------|-------------|-----------|
| `parses full material specification` | All 7 fields present | Complete data |
| `parses minimal material (name:percentage)` | Only required fields | Minimum data |
| `parses material with country only` | `Name:50:IT` | Partial data |
| `parses material with certification` | Certification fields present | Cert handling |
| `handles multiple materials` | Semicolon-separated materials | Multi-material |
| `validates percentage is numeric` | Non-numeric percentage | Invalid data |
| `validates percentage range (0-100)` | `>100` or `<0` | Range validation |
| `handles invalid certification date format` | Non-ISO date | Date validation |
| `handles empty certification fields` | `Name:50:::` | Empty optionals |

### 5. Excel Parser - Column Validation

**File:** `unit/excel-parser/column-validation.test.ts`

Tests validation of required and optional columns.

| Test Name | Description | Edge Case |
|-----------|-------------|-----------|
| `accepts valid column names` | All expected columns present | Valid headers |
| `rejects missing required columns` | SKU or Barcode missing | Required fields |
| `ignores extra unknown columns` | Extra columns ignored | Unknown columns |
| `handles case variations in column names` | `"product title"` vs `"Product Title"` | Case handling |
| `validates attribute column pairs` | Attribute 1 without Value 1 | Paired columns |
| `accepts optional columns being empty` | Description, Image etc empty | Optional fields |

### 6. Excel Parser - Duplicate Detection

**File:** `unit/excel-parser/duplicate-detection.test.ts`

Tests detection of duplicate SKUs and barcodes within the import file.

| Test Name | Description | Edge Case |
|-----------|-------------|-----------|
| `detects duplicate SKUs within file` | Same SKU in multiple rows | SKU duplicate |
| `detects duplicate barcodes within file` | Same barcode in multiple rows | Barcode duplicate |
| `allows same SKU across different products (variant matching)` | Intentional duplicate for update | Update scenario |
| `reports all duplicate locations` | Shows which rows have duplicates | Error reporting |
| `handles case-insensitive SKU comparison` | `"SKU-001"` vs `"sku-001"` | Case handling |

### 7. Catalog Loader - Entity Resolution

**File:** `unit/catalog-loader/entity-resolution.test.ts`

Tests the in-memory catalog lookup functions.

| Test Name | Description | Edge Case |
|-----------|-------------|-----------|
| `looks up material by exact name` | Direct match | Exact match |
| `looks up material case-insensitively` | `"Cotton"` matches `"cotton"` | Case insensitive |
| `returns null for unknown material` | Material not in catalog | Not found |
| `checks value mappings before direct lookup` | Mapping takes precedence | Mapping priority |
| `looks up season by name` | Season resolution | Season lookup |
| `looks up category by name` | Category resolution | Category lookup |
| `looks up facility/operator by display name` | Facility resolution | Facility lookup |
| `looks up attribute by name` | Brand attribute resolution | Attribute lookup |
| `looks up attribute value by attribute+name` | Composite key lookup | Value lookup |
| `looks up taxonomy attribute by name` | Global taxonomy matching | Taxonomy attr |
| `looks up taxonomy value by attribute+name` | Taxonomy value matching | Taxonomy value |

### 8. Excel Export - Correction Generation

**File:** `unit/excel-export/correction-generation.test.ts`

Tests the correction Excel generation with error highlighting.

| Test Name | Description | Edge Case |
|-----------|-------------|-----------|
| `generates valid XLSX buffer` | Output is valid Excel | Basic generation |
| `applies red fill to error cells` | Cells with errors highlighted | Error highlighting |
| `preserves original data in cells` | Data not modified | Data preservation |
| `includes all columns in order` | Column order maintained | Column order |
| `handles rows with multiple errors` | Multiple cells highlighted per row | Multi-error row |
| `handles rows with no errors` | Non-error rows not highlighted | Clean rows |
| `freezes header row` | Header stays visible on scroll | Header freeze |
| `auto-sizes columns based on content` | Column widths adjusted | Auto-sizing |

---

## Integration Tests

### 1. Import Job Lifecycle

**File:** `integration/job-lifecycle.test.ts`

Tests the complete import job state machine.

| Test Name | Description | Edge Case |
|-----------|-------------|-----------|
| `creates job in PENDING status` | Initial job creation | Job creation |
| `transitions PENDING -> VALIDATING` | Job starts validation | Status transition |
| `transitions VALIDATING -> VALIDATED` | Validation completes | Validation success |
| `transitions VALIDATED -> COMMITTING` | Commit phase starts | Commit start |
| `transitions COMMITTING -> COMPLETED` | Successful completion | Full success |
| `transitions to COMPLETED_WITH_FAILURES` | Partial success | Partial completion |
| `transitions to FAILED on critical error` | Job failure | Error handling |
| `updates progress counts during validation` | Progress tracking | Progress updates |
| `updates progress counts during commit` | Commit progress | Commit progress |
| `records timing information` | startedAt, finishedAt | Timing capture |

### 2. CREATE Mode - Basic Operations

**File:** `integration/create-mode/basic-operations.test.ts`

Tests CREATE mode with existing catalog entities.

| Test Name | Description | Edge Case |
|-----------|-------------|-----------|
| `creates new product with existing category` | Category must exist | Basic create |
| `creates new product with existing manufacturer` | Manufacturer lookup | Manufacturer |
| `creates new product with existing season` | Season lookup | Season |
| `creates variants with existing attributes` | Attribute/value lookup | Attributes |
| `links existing materials to product` | Material lookup | Materials |
| `links existing facilities to journey` | Facility lookup | Journey |
| `links existing tags to product` | Tag lookup | Tags |
| `links existing eco claims to product` | Eco claim lookup | Eco claims |
| `fails when category doesn't exist` | Category required | Missing category |
| `fails when manufacturer doesn't exist` | No auto-create | Missing manufacturer |
| `generates UPID for new variants` | Auto UPID generation | UPID creation |

### 3. CREATE_AND_ENRICH Mode - Entity Auto-Creation

**File:** `integration/create-and-enrich-mode/entity-auto-creation.test.ts`

Tests CREATE_AND_ENRICH mode with automatic entity creation.

| Test Name | Description | Edge Case |
|-----------|-------------|-----------|
| `auto-creates manufacturer when not found` | New manufacturer created | Manufacturer auto |
| `auto-creates season when not found` | New season created | Season auto |
| `auto-creates tag when not found` | New tag created | Tag auto |
| `auto-creates material when not found` | New material created | Material auto |
| `auto-creates facility when not found` | New facility created | Facility auto |
| `auto-creates attribute when not found` | New brand attribute | Attribute auto |
| `auto-creates attribute value when not found` | New attribute value | Value auto |
| `reuses existing entity if found` | No duplicate creation | Existing entity |
| `matches taxonomy attribute when creating brand attribute` | Links to taxonomy | Taxonomy matching |
| `matches taxonomy value when creating brand attribute value` | Links to taxonomy value | Taxonomy value |
| `still fails when category doesn't exist` | Categories never auto-created | Category exception |

### 4. CREATE_AND_ENRICH Mode - Attribute Auto-Creation

**File:** `integration/create-and-enrich-mode/attribute-auto-creation.test.ts`

Tests the attribute and value auto-creation with taxonomy matching.

| Test Name | Description | Edge Case |
|-----------|-------------|-----------|
| `creates brand attribute with taxonomy link` | Links Color -> taxonomy Color | Taxonomy link |
| `creates brand attribute without taxonomy (no match)` | Custom attribute | No taxonomy |
| `creates attribute value with taxonomy value link` | Blue -> taxonomy Blue | Value taxonomy |
| `handles case-insensitive taxonomy matching` | "color" matches "Color" | Case handling |
| `creates multiple attribute values for same attribute` | S, M, L for Size | Multi-value |
| `handles attribute created mid-import` | New attr used in later rows | In-flight creation |

### 5. Product Updates

**File:** `integration/product-updates.test.ts`

Tests updating existing products via import.

| Test Name | Description | Edge Case |
|-----------|-------------|-----------|
| `updates existing product by handle` | Handle match | Handle update |
| `updates variant by SKU match` | SKU match | SKU update |
| `updates variant by barcode match` | Barcode match | Barcode update |
| `adds new variant to existing product` | New SKU on existing product | Variant addition |
| `updates product-level fields` | Title, Description, etc | Product fields |
| `updates variant-level fields` | Weight, attributes | Variant fields |
| `preserves existing data when field is empty` | Empty = no change | Partial update |
| `replaces array fields (tags, materials)` | Full replacement | Array handling |

### 6. Staging Flow

**File:** `integration/staging-flow.test.ts`

Tests the staging table operations.

| Test Name | Description | Edge Case |
|-----------|-------------|-----------|
| `creates staging records for all products` | Product staging | Staging creation |
| `creates staging records for all variants` | Variant staging | Variant staging |
| `stores validation errors in staging` | Error recording | Error storage |
| `marks staging records as committed` | Commit tracking | Commit marking |
| `preserves raw row data in staging` | Original data kept | Data preservation |
| `tracks row numbers in staging` | Source row tracking | Row tracking |

### 7. Error Handling - Validation Errors

**File:** `integration/error-handling/validation-errors.test.ts`

Tests validation error scenarios and handling.

| Test Name | Description | Edge Case |
|-----------|-------------|-----------|
| `reports missing required field (SKU)` | SKU required | Missing SKU |
| `reports missing required field (Barcode)` | Barcode required | Missing barcode |
| `reports invalid category` | Category not found | Bad category |
| `reports invalid attribute format` | Attribute without value | Bad attribute |
| `reports invalid material percentage` | Non-numeric percent | Bad material |
| `reports duplicate SKU in database` | Existing SKU conflict | SKU conflict |
| `reports duplicate barcode in database` | Existing barcode conflict | Barcode conflict |
| `continues processing after row error` | Other rows processed | Partial success |
| `aggregates errors per row` | Multiple errors per row | Error aggregation |
| `stores errors in staging for export` | Errors exportable | Error export |

### 8. Error Handling - System Errors

**File:** `integration/error-handling/system-errors.test.ts`

Tests system-level error handling.

| Test Name | Description | Edge Case |
|-----------|-------------|-----------|
| `handles database connection failure` | DB unavailable | DB error |
| `handles storage download failure` | File not found | Storage error |
| `handles invalid Excel file format` | Corrupt file | Parse error |
| `handles empty Excel file` | No data rows | Empty file |
| `handles timeout during validation` | Long-running job | Timeout |
| `rolls back on commit failure` | Partial commit | Rollback |

### 9. Image Processing

**File:** `integration/image-processing.test.ts`

Tests image URL handling and status.

| Test Name | Description | Edge Case |
|-----------|-------------|-----------|
| `accepts valid image URL` | HTTPS URL | Valid URL |
| `stores image URL in product` | URL persisted | URL storage |
| `handles missing image` | Empty image field | No image |
| `handles variant-level image override` | Child row image | Override image |
| `validates URL format` | Invalid URL rejected | URL validation |

### 10. Tags Processing

**File:** `integration/tags-processing.test.ts`

Tests tag handling.

| Test Name | Description | Edge Case |
|-----------|-------------|-----------|
| `links existing tags` | Tags found in catalog | Existing tags |
| `creates new tags in ENRICH mode` | Auto-create tags | New tags |
| `fails for unknown tags in CREATE mode` | No auto-create | Unknown tags |
| `handles semicolon-separated tags` | Multiple tags | Multi-tag |
| `handles duplicate tags in input` | Deduplication | Dup tags |
| `handles empty tags field` | No tags | Empty tags |

### 11. Materials Processing

**File:** `integration/materials-processing.test.ts`

Tests material handling with full specification.

| Test Name | Description | Edge Case |
|-----------|-------------|-----------|
| `links material with percentage` | Basic material link | Material link |
| `links material with country` | Country specified | Country |
| `links material with certification` | Full cert data | Certification |
| `creates material in ENRICH mode` | Auto-create material | New material |
| `validates percentage totals warn >100` | Sum > 100 | Over 100% |
| `handles multiple materials` | Multi-material product | Multi-material |

### 12. Journey Steps Processing

**File:** `integration/journey-processing.test.ts`

Tests supply chain journey handling.

| Test Name | Description | Edge Case |
|-----------|-------------|-----------|
| `links Raw Material facility` | First step | Raw Material |
| `links Weaving facility` | Process step | Weaving |
| `links Dyeing/Printing facility` | Process step | Dyeing |
| `links Stitching facility` | Process step | Stitching |
| `links Assembly facility` | Process step | Assembly |
| `links Finishing facility` | Final step | Finishing |
| `creates facility in ENRICH mode` | Auto-create | New facility |
| `handles missing journey steps` | Partial journey | Partial |
| `maintains journey step order` | Order preserved | Order |

### 13. Environmental Data Processing

**File:** `integration/environmental-data.test.ts`

Tests environmental impact data handling.

| Test Name | Description | Edge Case |
|-----------|-------------|-----------|
| `stores Kilograms CO2 at product level` | CO2 data | CO2 |
| `stores Liters Water Used at product level` | Water data | Water |
| `stores Carbon Footprint at product level` | Footprint data | Footprint |
| `handles decimal values` | `2.5` kg CO2 | Decimals |
| `handles empty environmental fields` | No env data | Empty |
| `ignores environmental data in child rows` | Product-level only | Child ignore |

### 14. Performance Tests

**File:** `integration/performance.test.ts`

Tests performance with larger datasets.

| Test Name | Description | Edge Case |
|-----------|-------------|-----------|
| `processes 100 products in reasonable time` | Medium dataset | 100 products |
| `processes 1000 variants in reasonable time` | Large variant set | 1000 variants |
| `catalog loader caches efficiently` | No N+1 queries | Query efficiency |
| `staging inserts are batched` | Bulk insert | Batch insert |
| `commit phase uses batched operations` | Bulk operations | Batch commit |

### 15. Cleanup Operations

**File:** `integration/cleanup-operations.test.ts`

Tests staging cleanup functionality.

| Test Name | Description | Edge Case |
|-----------|-------------|-----------|
| `cleans up staging data after successful commit` | Post-commit cleanup | Success cleanup |
| `preserves staging data for failed rows` | Keep for export | Failure preserve |
| `dismiss removes staging data` | Manual dismiss | Dismiss cleanup |
| `scheduled cleanup removes old staging data` | Age-based cleanup | Scheduled |
| `scheduled cleanup respects retention period` | 7-day retention | Retention |

### 16. API Routes

**File:** `integration/api-routes.test.ts`

Tests the tRPC API endpoints.

| Test Name | Description | Edge Case |
|-----------|-------------|-----------|
| `preview returns file summary` | Preview endpoint | Preview |
| `preview returns first product data` | Product preview | First product |
| `start creates job and returns ID` | Start endpoint | Start |
| `status returns job progress` | Status endpoint | Status |
| `getRecentImports returns job history` | History endpoint | History |
| `dismiss cleans up failed import` | Dismiss endpoint | Dismiss |
| `enforces brand ownership on all endpoints` | Auth check | Authorization |
| `validates file belongs to brand` | File ownership | File auth |

### 17. Edge Cases

**File:** `integration/edge-cases.test.ts`

Tests unusual but valid scenarios.

| Test Name | Description | Edge Case |
|-----------|-------------|-----------|
| `handles product with 50 variants` | Many variants | High variant count |
| `handles very long product title` | 500+ chars | Long strings |
| `handles special characters in text fields` | Unicode, emoji | Special chars |
| `handles very long description` | 10000+ chars | Long description |
| `handles product handle with special chars` | Dashes, numbers | Special handle |
| `handles variant with all optional fields empty` | Minimal variant | Minimal data |
| `handles re-import of same file` | Idempotency | Re-import |
| `handles concurrent imports for same brand` | Race condition | Concurrency |

---

## File Tree Structure

```
packages/jobs/
├── __tests__/
│   ├── setup.ts                                    # Global test setup
│   ├── fixtures/
│   │   ├── excel/
│   │   │   ├── valid-single-product.xlsx           # One product, one variant
│   │   │   ├── valid-multi-variant.xlsx            # One product, multiple variants
│   │   │   ├── valid-multi-product.xlsx            # Multiple products
│   │   │   ├── valid-with-all-fields.xlsx          # All columns populated
│   │   │   ├── invalid-missing-sku.xlsx            # Missing required field
│   │   │   ├── invalid-missing-barcode.xlsx        # Missing required field
│   │   │   ├── invalid-bad-materials.xlsx          # Invalid material format
│   │   │   ├── invalid-duplicate-sku.xlsx          # Duplicate SKUs
│   │   │   ├── empty-file.xlsx                     # No data rows
│   │   │   ├── header-only.xlsx                    # Only headers
│   │   │   └── large-dataset.xlsx                  # 100+ products
│   │   └── data/
│   │       ├── catalog-fixtures.ts                 # Brand catalog test data
│   │       ├── product-fixtures.ts                 # Product test data
│   │       └── staging-fixtures.ts                 # Staging table test data
│   │
│   ├── unit/
│   │   ├── excel-parser/
│   │   │   ├── row-grouping.test.ts
│   │   │   ├── data-levels.test.ts
│   │   │   ├── semicolon-parsing.test.ts
│   │   │   ├── materials-parsing.test.ts
│   │   │   ├── column-validation.test.ts
│   │   │   └── duplicate-detection.test.ts
│   │   ├── catalog-loader/
│   │   │   └── entity-resolution.test.ts
│   │   └── excel-export/
│   │       └── correction-generation.test.ts
│   │
│   └── integration/
│       ├── job-lifecycle.test.ts
│       ├── create-mode/
│       │   └── basic-operations.test.ts
│       ├── create-and-enrich-mode/
│       │   ├── entity-auto-creation.test.ts
│       │   └── attribute-auto-creation.test.ts
│       ├── product-updates.test.ts
│       ├── staging-flow.test.ts
│       ├── error-handling/
│       │   ├── validation-errors.test.ts
│       │   └── system-errors.test.ts
│       ├── image-processing.test.ts
│       ├── tags-processing.test.ts
│       ├── materials-processing.test.ts
│       ├── journey-processing.test.ts
│       ├── environmental-data.test.ts
│       ├── performance.test.ts
│       ├── cleanup-operations.test.ts
│       ├── api-routes.test.ts
│       └── edge-cases.test.ts

packages/testing/src/
├── bulk-import/
│   ├── index.ts                                    # Re-exports
│   ├── excel-builder.ts                            # Programmatic Excel creation
│   ├── mock-storage.ts                             # Mock Supabase storage
│   ├── mock-trigger.ts                             # Mock Trigger.dev tasks
│   ├── test-catalog.ts                             # Test brand catalog setup
│   └── test-database.ts                            # Test database utilities
```

---

## Testing Utilities

### 1. Excel Builder (`packages/testing/src/bulk-import/excel-builder.ts`)

Utility for creating test Excel files programmatically.

```typescript
interface ExcelBuilderOptions {
  products: TestProduct[];
  includeHeaders?: boolean;
  sheetName?: string;
}

interface TestProduct {
  handle?: string;
  title?: string;
  manufacturer?: string;
  description?: string;
  category?: string;
  season?: string;
  tags?: string;
  image?: string;
  ecoClaims?: string;
  materials?: string;
  journey?: {
    rawMaterial?: string;
    weaving?: string;
    dyeing?: string;
    stitching?: string;
    assembly?: string;
    finishing?: string;
  };
  environmental?: {
    co2?: string;
    water?: string;
    footprint?: string;
  };
  variants: TestVariant[];
}

interface TestVariant {
  sku: string;
  barcode: string;
  attributes?: Array<{ name: string; value: string }>;
  weight?: string;
  // Override fields for child rows
  title?: string;
  description?: string;
  image?: string;
}

class ExcelBuilder {
  static create(options: ExcelBuilderOptions): Promise<Uint8Array>;
  static createSingleProduct(product: TestProduct): Promise<Uint8Array>;
  static createFromRows(rows: Record<string, string>[]): Promise<Uint8Array>;
}
```

### 2. Mock Storage (`packages/testing/src/bulk-import/mock-storage.ts`)

Mock for Supabase storage operations.

```typescript
interface MockStorageOptions {
  files?: Map<string, Uint8Array>;
  failOnPaths?: string[];
}

class MockStorage {
  static setup(options?: MockStorageOptions): void;
  static addFile(path: string, content: Uint8Array): void;
  static clear(): void;
  static getDownloadCount(path: string): number;
}
```

### 3. Mock Trigger (`packages/testing/src/bulk-import/mock-trigger.ts`)

Mock for Trigger.dev task execution.

```typescript
interface MockTriggerOptions {
  failTasks?: string[];
  delayMs?: number;
}

class MockTrigger {
  static setup(options?: MockTriggerOptions): void;
  static getTriggeredTasks(): Array<{ name: string; payload: unknown }>;
  static clear(): void;
}
```

### 4. Test Catalog (`packages/testing/src/bulk-import/test-catalog.ts`)

Utility for setting up test brand catalog data.

```typescript
interface TestCatalogOptions {
  brandId: string;
  materials?: string[];
  seasons?: string[];
  categories?: string[];
  attributes?: Array<{ name: string; values: string[] }>;
  facilities?: string[];
  tags?: string[];
  ecoClaims?: string[];
  manufacturers?: string[];
}

class TestCatalog {
  static async setup(db: Database, options: TestCatalogOptions): Promise<void>;
  static async cleanup(db: Database, brandId: string): Promise<void>;
}
```

### 5. Test Database (`packages/testing/src/bulk-import/test-database.ts`)

Database utilities for integration tests.

```typescript
class TestDatabase {
  static async createTestBrand(db: Database): Promise<string>;
  static async cleanup(db: Database, brandId: string): Promise<void>;
  static async getProduct(db: Database, handle: string): Promise<Product | null>;
  static async getVariant(db: Database, sku: string): Promise<Variant | null>;
  static async getStagingRecords(db: Database, jobId: string): Promise<StagingRecord[]>;
}
```

---

## Phased Implementation Plan

### Phase 1: Foundation (Days 1-2)

**Goal:** Set up testing infrastructure and create basic test utilities.

#### Tasks:

1. **Create test directory structure**
   - Create `packages/jobs/__tests__/` folder structure
   - Create `packages/testing/src/bulk-import/` folder

2. **Create global test setup**
   - File: `packages/jobs/__tests__/setup.ts`
   - Database connection for tests
   - Test cleanup hooks
   - MSW server setup

3. **Create Excel Builder utility**
   - File: `packages/testing/src/bulk-import/excel-builder.ts`
   - Programmatic Excel file creation
   - Support for all column types

4. **Create test fixtures**
   - Basic Excel fixture files
   - Catalog data fixtures

5. **Verify test runner configuration**
   - Ensure Bun test works for jobs package
   - Configure test scripts in package.json

#### Deliverables:
- Working test setup with one passing placeholder test
- Excel builder utility
- Basic fixture files

---

### Phase 2: Unit Tests - Excel Parser (Days 3-4)

**Goal:** Complete unit tests for Excel parsing functionality.

#### Tasks:

1. **Row Grouping Tests**
   - File: `unit/excel-parser/row-grouping.test.ts`
   - 9 tests for Shopify-style row grouping

2. **Data Levels Tests**
   - File: `unit/excel-parser/data-levels.test.ts`
   - 8 tests for product vs variant data separation

3. **Semicolon Parsing Tests**
   - File: `unit/excel-parser/semicolon-parsing.test.ts`
   - 7 tests for semicolon-separated value parsing

4. **Materials Parsing Tests**
   - File: `unit/excel-parser/materials-parsing.test.ts`
   - 9 tests for material specification parsing

5. **Column Validation Tests**
   - File: `unit/excel-parser/column-validation.test.ts`
   - 6 tests for column header validation

6. **Duplicate Detection Tests**
   - File: `unit/excel-parser/duplicate-detection.test.ts`
   - 5 tests for SKU/barcode duplicate detection

#### Deliverables:
- 44 passing unit tests for Excel parser
- All edge cases covered

---

### Phase 3: Unit Tests - Supporting Modules (Day 5)

**Goal:** Complete unit tests for catalog loader and Excel export.

#### Tasks:

1. **Catalog Loader Tests**
   - File: `unit/catalog-loader/entity-resolution.test.ts`
   - 11 tests for entity resolution functions

2. **Excel Export Tests**
   - File: `unit/excel-export/correction-generation.test.ts`
   - 8 tests for correction Excel generation

#### Deliverables:
- 19 additional passing unit tests
- 63 total unit tests passing

---

### Phase 4: Integration Tests - Core Flow (Days 6-7)

**Goal:** Test the main import flow end-to-end.

#### Tasks:

1. **Create Mock Storage utility**
   - File: `packages/testing/src/bulk-import/mock-storage.ts`

2. **Create Mock Trigger utility**
   - File: `packages/testing/src/bulk-import/mock-trigger.ts`

3. **Create Test Catalog utility**
   - File: `packages/testing/src/bulk-import/test-catalog.ts`

4. **Create Test Database utility**
   - File: `packages/testing/src/bulk-import/test-database.ts`

5. **Job Lifecycle Tests**
   - File: `integration/job-lifecycle.test.ts`
   - 10 tests for job state machine

6. **CREATE Mode Tests**
   - File: `integration/create-mode/basic-operations.test.ts`
   - 11 tests for CREATE mode operations

7. **Staging Flow Tests**
   - File: `integration/staging-flow.test.ts`
   - 6 tests for staging operations

#### Deliverables:
- Testing utilities complete
- 27 integration tests passing

---

### Phase 5: Integration Tests - CREATE_AND_ENRICH Mode (Day 8)

**Goal:** Test auto-creation functionality.

#### Tasks:

1. **Entity Auto-Creation Tests**
   - File: `integration/create-and-enrich-mode/entity-auto-creation.test.ts`
   - 11 tests for entity auto-creation

2. **Attribute Auto-Creation Tests**
   - File: `integration/create-and-enrich-mode/attribute-auto-creation.test.ts`
   - 6 tests for attribute/value creation with taxonomy

#### Deliverables:
- 17 additional integration tests
- ENRICH mode fully tested

---

### Phase 6: Integration Tests - Entity Processing (Days 9-10)

**Goal:** Test all entity types processing.

#### Tasks:

1. **Product Updates Tests**
   - File: `integration/product-updates.test.ts`
   - 8 tests for update scenarios

2. **Tags Processing Tests**
   - File: `integration/tags-processing.test.ts`
   - 6 tests for tag handling

3. **Materials Processing Tests**
   - File: `integration/materials-processing.test.ts`
   - 6 tests for material handling

4. **Journey Processing Tests**
   - File: `integration/journey-processing.test.ts`
   - 9 tests for journey step handling

5. **Environmental Data Tests**
   - File: `integration/environmental-data.test.ts`
   - 6 tests for environmental data

6. **Image Processing Tests**
   - File: `integration/image-processing.test.ts`
   - 5 tests for image handling

#### Deliverables:
- 40 additional integration tests
- All entity types tested

---

### Phase 7: Integration Tests - Error Handling & Edge Cases (Day 11)

**Goal:** Test error scenarios and edge cases.

#### Tasks:

1. **Validation Error Tests**
   - File: `integration/error-handling/validation-errors.test.ts`
   - 10 tests for validation errors

2. **System Error Tests**
   - File: `integration/error-handling/system-errors.test.ts`
   - 6 tests for system errors

3. **Edge Cases Tests**
   - File: `integration/edge-cases.test.ts`
   - 8 tests for unusual scenarios

#### Deliverables:
- 24 additional integration tests
- Error handling comprehensively tested

---

### Phase 8: Integration Tests - API & Performance (Day 12)

**Goal:** Test API routes and performance.

#### Tasks:

1. **API Routes Tests**
   - File: `integration/api-routes.test.ts`
   - 8 tests for tRPC endpoints

2. **Performance Tests**
   - File: `integration/performance.test.ts`
   - 5 tests for performance benchmarks

3. **Cleanup Operations Tests**
   - File: `integration/cleanup-operations.test.ts`
   - 5 tests for cleanup functionality

#### Deliverables:
- 18 additional integration tests
- All 149 tests complete

---

### Phase 9: Documentation & CI (Day 13)

**Goal:** Finalize documentation and CI integration.

#### Tasks:

1. **Update package.json scripts**
   - Add test commands for bulk import tests
   - Add coverage commands

2. **Create test documentation**
   - Document test utilities
   - Document fixture usage
   - Document how to add new tests

3. **CI Integration**
   - Ensure tests run in CI pipeline
   - Set up coverage reporting

4. **Review and cleanup**
   - Remove any test.todo() items
   - Ensure all tests are meaningful
   - Final code review

#### Deliverables:
- Complete test suite with 149 tests
- CI integration
- Documentation

---

## Test Commands

```bash
# Run all bulk import tests
bun test packages/jobs/__tests__

# Run only unit tests
bun test packages/jobs/__tests__/unit

# Run only integration tests
bun test packages/jobs/__tests__/integration

# Run specific test file
bun test packages/jobs/__tests__/unit/excel-parser/row-grouping.test.ts

# Run tests with coverage
bun test packages/jobs/__tests__ --coverage

# Run tests in watch mode
bun test packages/jobs/__tests__ --watch
```

---

## Success Criteria

- [ ] All 149 tests passing
- [ ] Code coverage > 80% for bulk import modules
- [ ] All edge cases documented and tested
- [ ] Tests run in CI pipeline
- [ ] Test utilities reusable for future tests
- [ ] No flaky tests (run 10x without failure)
