# Integration Testing Document

This document provides a complete guide for setting up and running automated integration tests for the Avelero integration system (Shopify connector).

## Table of Contents

1. [Infrastructure Setup Plan](#part-1-infrastructure-setup-plan)
2. [Test Checklist](#part-2-test-checklist)
3. [Automation Analysis](#part-3-automation-analysis)

---

# Part 1: Infrastructure Setup Plan

## Current State of Repository

| Item | Status | Location |
|------|--------|----------|
| Test runner (Jest) | ⚠️ Installed but unused | Root `package.json` - lines 6, 9 |
| Test command | ✅ Exists | `bun run test` → `turbo test --parallel` |
| Test scripts in packages | ❌ Missing | No `test` script in any package |
| Test database | ❌ Not configured | Using production Supabase only |
| Mocking library | ❌ Not installed | Need MSW for Shopify API mocking |
| CI test workflow | ❌ Missing | Only lint + typecheck in current workflows |
| Integration tests | ❌ None | No test files exist |

---

## Changes Required

### Step 1: Remove Jest (Unused)

**File:** `/package.json` (root)

**Remove these lines:**
```json
"@types/jest": "^30.0.0",
"jest": "^30.1.3",
```

**Action:** Delete lines 6 and 9 from root `package.json`

---

### Step 2: Install New Packages

**File:** `/packages/integrations/package.json`

**Add devDependencies:**
```json
"devDependencies": {
  "@types/node": "^24.0.1",
  "@v1/tsconfig": "workspace:*",
  "typescript": "^5.9.2",
  "vitest": "^3.0.0",           // NEW - Test runner
  "msw": "^2.7.0"               // NEW - Mock Service Worker for API mocking
}
```

**Add scripts:**
```json
"scripts": {
  "lint": "biome lint ./src",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",         // NEW - Run tests once
  "test:watch": "vitest"        // NEW - Run tests in watch mode
}
```

**Command to run:**
```bash
cd packages/integrations
bun add -D vitest msw
```

---

### Step 3: Create New Files

The following files need to be created:

#### 3.1 Vitest Configuration

**File:** `/packages/integrations/vitest.config.ts` (NEW)

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./__tests__/setup.ts'],
    include: ['__tests__/**/*.test.ts'],
    // Run tests sequentially to avoid DB conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Timeout for slow integration tests
    testTimeout: 30000,
  },
})
```

#### 3.2 Test Setup File

**File:** `/packages/integrations/__tests__/setup.ts` (NEW)

```typescript
import { beforeAll, afterAll, afterEach } from 'vitest'
import { mockServer } from './utils/mock-shopify'
import { testDb, cleanupTables } from './utils/test-db'

// Start MSW mock server before all tests
beforeAll(() => {
  mockServer.listen({ onUnhandledRequest: 'error' })
})

// Reset handlers after each test
afterEach(async () => {
  mockServer.resetHandlers()
  await cleanupTables(testDb)
})

// Close mock server after all tests
afterAll(() => {
  mockServer.close()
})
```

#### 3.3 Test Database Utility

**File:** `/packages/integrations/__tests__/utils/test-db.ts` (NEW)

```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@v1/db/schema'

// Use test database URL from environment
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required for tests')
}

const client = postgres(connectionString)
export const testDb = drizzle(client, { schema })

// Tables to clean between tests (in order due to foreign keys)
const tablesToClean = [
  schema.integrationVariantLinks,
  schema.integrationProductLinks,
  schema.variantAttributeAssignments,
  schema.productVariants,
  schema.productTagAssignments,
  schema.products,
  schema.tags,
  schema.brandAttributeValues,
  schema.brandAttributes,
]

export async function cleanupTables(db: typeof testDb) {
  for (const table of tablesToClean) {
    await db.delete(table)
  }
}
```

#### 3.4 Mock Shopify Utility

**File:** `/packages/integrations/__tests__/utils/mock-shopify.ts` (NEW)

```typescript
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import type { ShopifyProductNode, ShopifyVariantNode } from '../../src/connectors/shopify/types'

// Factory to create mock Shopify products
export function createMockProduct(overrides: Partial<ShopifyProductNode> = {}): ShopifyProductNode {
  const productId = overrides.id || `gid://shopify/Product/${Date.now()}`
  
  return {
    id: productId,
    title: 'Test Product',
    description: 'A test product description',
    descriptionHtml: '<p>A test product description</p>',
    onlineStoreUrl: 'https://test.myshopify.com/products/test-product',
    status: 'ACTIVE',
    tags: [],
    category: null,
    featuredMedia: null,
    variants: {
      edges: [
        {
          node: {
            id: `gid://shopify/ProductVariant/${Date.now()}`,
            sku: 'TEST-001',
            barcode: null,
            selectedOptions: [],
          },
        },
      ],
    },
    ...overrides,
  }
}

// Factory to create mock variants
export function createMockVariant(overrides: Partial<ShopifyVariantNode> = {}): ShopifyVariantNode {
  return {
    id: `gid://shopify/ProductVariant/${Date.now()}`,
    sku: 'TEST-001',
    barcode: null,
    selectedOptions: [],
    ...overrides,
  }
}

// Default handler for Shopify GraphQL API
let mockProducts: ShopifyProductNode[] = []

export function setMockProducts(products: ShopifyProductNode[]) {
  mockProducts = products
}

export function clearMockProducts() {
  mockProducts = []
}

// MSW handlers
const handlers = [
  // Shopify GraphQL endpoint
  http.post('https://*.myshopify.com/admin/api/*/graphql.json', async () => {
    return HttpResponse.json({
      data: {
        products: {
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
          },
          edges: mockProducts.map((product) => ({ node: product })),
        },
      },
      extensions: {
        cost: {
          requestedQueryCost: 100,
          actualQueryCost: 50,
          throttleStatus: {
            maximumAvailable: 2000,
            currentlyAvailable: 1950,
            restoreRate: 100,
          },
        },
      },
    })
  }),

  // Shop query (for product count)
  http.post('https://*.myshopify.com/admin/api/*/graphql.json', async ({ request }) => {
    const body = await request.json() as { query: string }
    
    // Check if this is a product count query
    if (body.query?.includes('productsCount')) {
      return HttpResponse.json({
        data: {
          productsCount: {
            count: mockProducts.length,
          },
        },
      })
    }
    
    // Default products query
    return HttpResponse.json({
      data: {
        products: {
          pageInfo: { hasNextPage: false, endCursor: null },
          edges: mockProducts.map((product) => ({ node: product })),
        },
      },
    })
  }),
]

export const mockServer = setupServer(...handlers)
```

#### 3.5 Sync Context Factory

**File:** `/packages/integrations/__tests__/utils/sync-context.ts` (NEW)

```typescript
import type { SyncContext, FieldConfig } from '../../src/sync/types'
import { testDb } from './test-db'

// Default field configs (all enabled)
const defaultFieldConfigs: FieldConfig[] = [
  { fieldKey: 'product.name', isEnabled: true, selectedSource: 'title' },
  { fieldKey: 'product.description', isEnabled: true, selectedSource: 'description' },
  { fieldKey: 'product.imagePath', isEnabled: true, selectedSource: 'featuredMedia.preview.image.url' },
  { fieldKey: 'product.webshopUrl', isEnabled: true, selectedSource: 'onlineStoreUrl' },
  { fieldKey: 'product.salesStatus', isEnabled: true, selectedSource: 'status' },
  { fieldKey: 'product.tags', isEnabled: true, selectedSource: 'tags' },
  { fieldKey: 'product.categoryId', isEnabled: true, selectedSource: 'category.id' },
  { fieldKey: 'variant.sku', isEnabled: true, selectedSource: 'sku' },
  { fieldKey: 'variant.barcode', isEnabled: true, selectedSource: 'barcode' },
  { fieldKey: 'variant.attributes', isEnabled: true, selectedSource: 'selectedOptions' },
]

export function createTestSyncContext(overrides: Partial<SyncContext> = {}): SyncContext {
  return {
    db: testDb as any,
    storageClient: null as any, // Mock storage client if needed
    brandId: 'test-brand-id',
    fieldConfigs: defaultFieldConfigs,
    ...overrides,
  }
}

export function createFieldConfigs(
  overrides: Partial<Record<string, boolean>> = {}
): FieldConfig[] {
  return defaultFieldConfigs.map((config) => ({
    ...config,
    isEnabled: overrides[config.fieldKey] ?? config.isEnabled,
  }))
}
```

#### 3.6 GitHub Actions Workflow

**File:** `/.github/workflows/test-integrations.yaml` (NEW)

```yaml
name: Integration Tests

on:
  push:
    branches:
      - main
      - 'feature/**'
      - 'feat/**'
    paths:
      - 'packages/integrations/**'
      - 'packages/db/**'

  pull_request:
    branches:
      - main
    paths:
      - 'packages/integrations/**'
      - 'packages/db/**'

jobs:
  test:
    name: 🧪 Integration Tests
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: avelero_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: 📥 Checkout repository
        uses: actions/checkout@v4

      - name: 🍞 Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: 📦 Install dependencies
        run: bun install

      - name: 🗄️ Apply database schema
        run: bun run db:push
        working-directory: ./packages/db
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/avelero_test

      - name: 🧪 Run integration tests
        run: bun run test
        working-directory: ./packages/integrations
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/avelero_test

      - name: 📊 Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: packages/integrations/test-results/
          retention-days: 7
```

---

## File Structure Overview

After implementation, the structure will be:

```
avelero-v2/
├── .github/
│   └── workflows/
│       ├── preview-app.yaml          (existing)
│       ├── preview-api.yaml          (existing)
│       └── test-integrations.yaml    (NEW)
│
├── packages/
│   ├── db/
│   │   └── src/schema/               (existing - source of truth)
│   │
│   └── integrations/
│       ├── package.json              (MODIFIED - add vitest, msw)
│       ├── vitest.config.ts          (NEW)
│       ├── src/                      (existing code)
│       └── __tests__/                (NEW directory)
│           ├── setup.ts
│           ├── utils/
│           │   ├── test-db.ts
│           │   ├── mock-shopify.ts
│           │   └── sync-context.ts
│           ├── sync/
│           │   ├── basic-sync.test.ts
│           │   ├── resync.test.ts
│           │   ├── field-config.test.ts
│           │   └── matching.test.ts
│           └── edge-cases/
│               ├── null-values.test.ts
│               ├── orphan-variants.test.ts
│               └── attributes.test.ts
│
└── package.json                      (MODIFIED - remove jest)
```

---

## How It Works

### Local Development

**Option 1: Run tests against local Supabase (recommended)**
```bash
# You already have local Supabase running via bun dev
cd packages/integrations
DATABASE_URL=postgres://postgres:postgres@localhost:54322/postgres bun run test
```

**Option 2: Run tests in CI only**
- Write tests locally, push to GitHub
- Tests run automatically in GitHub Actions
- View results in PR checks

### CI/CD Pipeline

```
Push to branch with changes in packages/integrations/** or packages/db/**
                    ↓
GitHub Actions triggers test-integrations.yaml
                    ↓
PostgreSQL service container starts (~5 seconds)
                    ↓
Dependencies installed (cached)
                    ↓
drizzle-kit push applies schema from packages/db/src/schema/
                    ↓
vitest runs all tests in packages/integrations/__tests__/
                    ↓
Results reported in PR checks
```

### Database Schema Sync

The schema is automatically applied in CI via:

```yaml
- name: 🗄️ Apply database schema
  run: bun run db:push
  working-directory: ./packages/db
  env:
    DATABASE_URL: postgres://test:test@localhost:5432/avelero_test
```

This runs `drizzle-kit push` which:
1. Reads your schema from `packages/db/src/schema/`
2. Introspects the test PostgreSQL database
3. Generates and applies SQL to make them match

**No manual versioning required** - the schema comes from your code.

---

## Mocking Shopify API (No API Key Needed)

MSW (Mock Service Worker) intercepts all HTTP requests during tests:

```
Your sync code:
  fetch('https://shop.myshopify.com/admin/api/.../graphql.json')
                    ↓
MSW intercepts (before network)
                    ↓
Returns mock data from mockShopifyProducts()
                    ↓
Your code processes mock data (thinks it's real)
```

**In tests:**
```typescript
import { setMockProducts, createMockProduct } from './utils/mock-shopify'

it('syncs products from Shopify', async () => {
  // Set up mock response
  setMockProducts([
    createMockProduct({ title: 'Product 1', variants: { edges: [...] } }),
    createMockProduct({ title: 'Product 2', variants: { edges: [...] } }),
  ])
  
  // Run sync - MSW returns mock data
  const result = await syncProducts(ctx)
  
  // Assert
  expect(result.productsCreated).toBe(2)
})
```

---

## Implementation Checklist

### Step 1: Package Changes
- [ ] Remove Jest from root `package.json` (delete 2 lines)
- [ ] Add vitest and msw to `packages/integrations/package.json`
- [ ] Add test scripts to `packages/integrations/package.json`
- [ ] Run `bun install` to update lockfile

### Step 2: Create Config Files
- [ ] Create `packages/integrations/vitest.config.ts`
- [ ] Create `packages/integrations/__tests__/setup.ts`

### Step 3: Create Utilities
- [ ] Create `packages/integrations/__tests__/utils/test-db.ts`
- [ ] Create `packages/integrations/__tests__/utils/mock-shopify.ts`
- [ ] Create `packages/integrations/__tests__/utils/sync-context.ts`

### Step 4: Create GitHub Workflow
- [ ] Create `.github/workflows/test-integrations.yaml`

### Step 5: Write First Test
- [ ] Create `packages/integrations/__tests__/sync/basic-sync.test.ts`
- [ ] Verify test runs locally
- [ ] Verify test runs in CI

---

## Estimated Time

| Task | Time |
|------|------|
| Step 1: Package changes | 10 minutes |
| Step 2: Config files | 15 minutes |
| Step 3: Utilities | 1 hour |
| Step 4: GitHub workflow | 15 minutes |
| Step 5: First test | 30 minutes |
| **Total setup** | **~2 hours** |

After setup, each additional test takes 15-30 minutes to write.

---

# Part 2: Test Checklist

All 32 tests below can be automated. No manual testing required.

## Prerequisites (Automated)

Before tests run (handled by setup.ts):
- ✅ PostgreSQL database available (CI service container)
- ✅ Schema applied via drizzle-kit push
- ✅ MSW mock server intercepting Shopify API calls
- ✅ Tables cleaned between each test

---

## Phase 1: Basic Product Sync (Clean Slate)

**Goal:** Verify basic sync functionality with various product configurations.

### Test 1.1: Single Product, No Variants
1. [ ] In Shopify, create a product with:
   - Title: "Test Simple Product"
   - No options/variants (just default variant)
   - Add SKU: `SIMPLE-001`
   - Add a description and image
2. [ ] In Avelero, go to Settings → Integrations → Shopify
3. [ ] Enable all fields (name, description, image, SKU, barcode, attributes)
4. [ ] Run sync
5. [ ] **Expected:** Product appears in Avelero with correct name, description, image
6. [ ] **Expected:** Single variant with SKU `SIMPLE-001`
7. [ ] **Expected:** No attributes assigned (no options in Shopify)

### Test 1.2: Product with One Attribute (Size)
1. [ ] In Shopify, create a product with:
   - Title: "Test Size Product"
   - Option: Size = S, M, L
   - SKUs: `SIZE-S`, `SIZE-M`, `SIZE-L`
2. [ ] Run sync
3. [ ] **Expected:** Product appears with 3 variants
4. [ ] **Expected:** Each variant has correct SKU
5. [ ] **Expected:** Size attribute created in Avelero with values S, M, L

### Test 1.3: Product with Two Attributes (Color × Size)
1. [ ] In Shopify, create a product with:
   - Title: "Test Color Size Product"
   - Option 1: Color = Red, Blue
   - Option 2: Size = S, M, L
   - 6 variants total with unique SKUs
2. [ ] Run sync
3. [ ] **Expected:** Product appears with 6 variants
4. [ ] **Expected:** Color and Size attributes created
5. [ ] **Expected:** Correct attribute values on each variant

### Test 1.4: Product with Three Attributes (Max)
1. [ ] In Shopify, create a product with:
   - Option 1: Color = Black, White
   - Option 2: Size = S, M
   - Option 3: Material = Cotton, Polyester
   - 8 variants total
2. [ ] Run sync
3. [ ] **Expected:** Product with 8 variants
4. [ ] **Expected:** 3 attributes created with correct values

### Test 1.5: Product with Tags
1. [ ] In Shopify, create a product with:
   - Tags: "Summer", "New Arrival", "Sale"
2. [ ] Run sync
3. [ ] **Expected:** Tags created in Avelero
4. [ ] **Expected:** Product associated with these tags

### Test 1.6: Product with Category
1. [ ] In Shopify, create a product with:
   - Category set to "Apparel > Shirts > T-shirts" (using Shopify taxonomy)
2. [ ] Run sync
3. [ ] **Expected:** Category mapped to Avelero's category system
4. [ ] **Expected:** Product has correct category assigned

---

## Phase 2: Re-Sync (No Changes)

**Goal:** Verify that re-syncing unchanged products is efficient (hash matching).

### Test 2.1: Re-sync Without Changes
1. [ ] Note the current sync stats (products created, updated, skipped)
2. [ ] Run sync again without any Shopify changes
3. [ ] **Expected:** All variants show as "skipped" (hash matched)
4. [ ] **Expected:** No database updates performed
5. [ ] **Expected:** Sync completes faster than initial sync

---

## Phase 3: Re-Sync (With Changes)

**Goal:** Verify that changes in Shopify are detected and synced.

### Test 3.1: Update Product Title
1. [ ] In Shopify, change "Test Simple Product" to "Test Simple Product Updated"
2. [ ] Run sync
3. [ ] **Expected:** Product name updated in Avelero
4. [ ] **Expected:** Only this product shows as updated

### Test 3.2: Update Variant SKU
1. [ ] In Shopify, change a variant's SKU from `SIZE-S` to `SIZE-S-NEW`
2. [ ] Run sync
3. [ ] **Expected:** Variant SKU updated in Avelero
4. [ ] **Expected:** Hash detects change, variant updated

### Test 3.3: Add New Variant
1. [ ] In Shopify, add size "XL" to "Test Size Product"
2. [ ] Run sync
3. [ ] **Expected:** New variant created with Size=XL
4. [ ] **Expected:** Existing variants unchanged
5. [ ] **Expected:** Size attribute now has 4 values

### Test 3.4: Remove Variant in Shopify
1. [ ] In Shopify, delete the XL variant
2. [ ] Run sync
3. [ ] **Expected:** XL variant remains in Avelero (orphaned)
4. [ ] **Expected:** XL variant no longer has integration link
5. [ ] **Expected:** Other variants still linked

### Test 3.5: Update Product Description
1. [ ] In Shopify, change product description
2. [ ] Run sync
3. [ ] **Expected:** Description updated in Avelero
4. [ ] **Expected:** Other fields unchanged

---

## Phase 4: Field Configuration

**Goal:** Verify field enable/disable behavior.

### Test 4.1: Disable Description Field
1. [ ] In Avelero, disable the "description" field for Shopify sync
2. [ ] In Shopify, update the description of a product
3. [ ] Run sync
4. [ ] **Expected:** Description NOT updated in Avelero (field disabled)
5. [ ] **Expected:** Previous description value preserved

### Test 4.2: Disable Attributes Field
1. [ ] In Avelero, disable the "variant.attributes" field
2. [ ] Run sync
3. [ ] **Expected:** Existing attribute assignments preserved
4. [ ] **Expected:** No new attribute assignments made

### Test 4.3: Re-enable Description Field
1. [ ] In Avelero, re-enable the "description" field
2. [ ] Run sync
3. [ ] **Expected:** Description now synced from Shopify
4. [ ] **Expected:** Avelero description updated to Shopify value

### Test 4.4: Disable SKU Field
1. [ ] In Avelero, disable the "variant.sku" field
2. [ ] In Shopify, change a SKU
3. [ ] Run sync
4. [ ] **Expected:** SKU NOT updated in Avelero
5. [ ] **Expected:** Variant still matched by existing link (not SKU)

---

## Phase 5: Product Matching (Existing Products)

**Goal:** Verify SKU/barcode matching for existing Avelero products.

### Test 5.1: Match by SKU
1. [ ] In Avelero, manually create a product with:
   - Name: "Manual Product"
   - One variant with SKU: `MATCH-SKU-001`
2. [ ] In Shopify, create a product with:
   - A variant with SKU: `MATCH-SKU-001`
3. [ ] Run sync
4. [ ] **Expected:** Shopify product links to existing Avelero product
5. [ ] **Expected:** NO duplicate product created
6. [ ] **Expected:** Variant linked, other fields synced

### Test 5.2: Match by Barcode
1. [ ] In Avelero, create a product with:
   - Variant with barcode: `1234567890123`
2. [ ] In Shopify, create a product with:
   - Variant with barcode: `1234567890123`
3. [ ] Run sync
4. [ ] **Expected:** Products matched by barcode
5. [ ] **Expected:** Link created, no duplicate

### Test 5.3: No Match (New Product Created)
1. [ ] In Shopify, create a product with:
   - Unique SKU: `UNIQUE-NEW-001`
   - No matching product in Avelero
2. [ ] Run sync
3. [ ] **Expected:** New product created in Avelero
4. [ ] **Expected:** Product link created

### Test 5.4: Partial SKU Match
1. [ ] In Avelero, create a product with 3 variants:
   - SKUs: `PARTIAL-1`, `PARTIAL-2`, `PARTIAL-3`
2. [ ] In Shopify, create a product with 3 variants:
   - SKUs: `PARTIAL-1`, `PARTIAL-4`, `PARTIAL-5`
3. [ ] Run sync
4. [ ] **Expected:** Product matched via `PARTIAL-1`
5. [ ] **Expected:** Variants `PARTIAL-2`, `PARTIAL-3` remain (orphaned)
6. [ ] **Expected:** Variants `PARTIAL-4`, `PARTIAL-5` created as new
7. [ ] **Expected:** Total: 5 variants on product

---

## Phase 6: Edge Cases

**Goal:** Verify documented edge case behavior.

### Test 6.1: Null Values in Shopify
1. [ ] In Avelero, ensure a product has a description
2. [ ] In Shopify, clear the description (make it empty)
3. [ ] Run sync
4. [ ] **Expected:** Avelero description NOT cleared (null values ignored)
5. [ ] **Expected:** Previous description preserved

### Test 6.2: Same SKU Different Attributes
1. [ ] In Avelero, create product with variant SKU `ATTR-001`, Color=Red
2. [ ] In Shopify, create product with variant SKU `ATTR-001`, Size=Large
3. [ ] Run sync (with attributes enabled)
4. [ ] **Expected:** Variant matched by SKU
5. [ ] **Expected:** Attributes REPLACED (Color removed, Size=Large set)

### Test 6.3: Product Deleted in Shopify
1. [ ] Note a synced product's ID in Avelero
2. [ ] Delete that product in Shopify
3. [ ] Run sync
4. [ ] **Expected:** Product remains in Avelero
5. [ ] **Expected:** Product link becomes stale (not updated)

### Test 6.4: Duplicate SKU in Shopify
1. [ ] In Shopify, create two products with same SKU on different variants
2. [ ] Run sync
3. [ ] **Expected:** First product matched/created
4. [ ] **Expected:** Second product also synced (may create separate or match)
5. [ ] Document actual behavior

### Test 6.5: Very Long Product Name
1. [ ] In Shopify, create product with 300+ character name
2. [ ] Run sync
3. [ ] **Expected:** Name truncated to 255 characters
4. [ ] **Expected:** No error, product created

### Test 6.6: Special Characters in Title/Description
1. [ ] In Shopify, create product with:
   - Title containing: `Test "Quotes" & Ampersand <brackets>`
   - Description with HTML: `<p>Hello <b>World</b></p>`
2. [ ] Run sync
3. [ ] **Expected:** Title preserved with special chars
4. [ ] **Expected:** Description HTML stripped (plain text)

---

## Phase 7: Multi-Sync Scenarios

**Goal:** Verify complex multi-step sync scenarios.

### Test 7.1: Create → Sync → Edit in Avelero → Re-sync
1. [ ] Create product in Shopify
2. [ ] Sync to Avelero
3. [ ] In Avelero, manually edit the product description
4. [ ] In Shopify, edit the same product's title
5. [ ] Run sync
6. [ ] **Expected:** Title updated from Shopify
7. [ ] **Expected:** Description overwritten from Shopify (if enabled)
8. [ ] **Document:** Avelero edits are overwritten by external source

### Test 7.2: Multiple Syncs in Succession
1. [ ] Run sync 3 times in quick succession
2. [ ] **Expected:** No duplicate products created
3. [ ] **Expected:** Links remain consistent
4. [ ] **Expected:** No errors

### Test 7.3: Sync → Disconnect → Reconnect → Sync
1. [ ] Sync products
2. [ ] Disconnect Shopify integration
3. [ ] Reconnect same Shopify store
4. [ ] Run sync
5. [ ] **Expected:** Products re-matched by SKU/barcode
6. [ ] **Expected:** No duplicates created

---

## Phase 8: Performance & Limits

**Goal:** Verify handling of large datasets and limits.

### Test 8.1: Sync 100+ Products
1. [ ] Ensure Shopify has 100+ products
2. [ ] Run sync
3. [ ] **Expected:** All products synced successfully
4. [ ] **Expected:** Progress tracking works
5. [ ] Note total sync time

### Test 8.2: Product with 50+ Variants
1. [ ] In Shopify, create product with many variants (e.g., 10 colors × 5 sizes)
2. [ ] Run sync
3. [ ] **Expected:** All 50 variants created
4. [ ] **Expected:** Attributes correctly assigned

### Test 8.3: Product at 500 Variant Limit
1. [ ] Create product in Shopify approaching 500 variants
2. [ ] Run sync
3. [ ] **Expected:** Variants up to 500 created
4. [ ] **Expected:** Graceful handling (warning in logs if truncated)

---

## Testing Completion Checklist

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Basic Sync | ☐ | |
| Phase 2: Re-Sync (No Changes) | ☐ | |
| Phase 3: Re-Sync (With Changes) | ☐ | |
| Phase 4: Field Configuration | ☐ | |
| Phase 5: Product Matching | ☐ | |
| Phase 6: Edge Cases | ☐ | |
| Phase 7: Multi-Sync Scenarios | ☐ | |
| Phase 8: Performance & Limits | ☐ | |

---

---

# Part 3: Automation Analysis

For each test, we assess whether it can be automated and the type of test required.

## Test Types Reference

| Type | Description | Requires |
|------|-------------|----------|
| **Unit Test** | Tests isolated functions with mocked dependencies | No external services |
| **Integration Test** | Tests multiple components working together | Test database |
| **E2E Test** | Tests complete user flows | Running app, browser |
| **Mock API Test** | Tests API handlers with mocked external APIs | Mocked Shopify responses |

---

## Phase 1: Basic Product Sync

| Test | Automatable? | Type | Implementation Notes |
|------|-------------|------|---------------------|
| 1.1 Single Product, No Variants | ✅ Yes | **Integration Test** | Mock Shopify API response, verify DB state |
| 1.2 Product with One Attribute | ✅ Yes | **Integration Test** | Mock response with size options |
| 1.3 Product with Two Attributes | ✅ Yes | **Integration Test** | Mock response with color × size |
| 1.4 Product with Three Attributes | ✅ Yes | **Integration Test** | Mock response with 3 options |
| 1.5 Product with Tags | ✅ Yes | **Integration Test** | Verify tag creation + assignment |
| 1.6 Product with Category | ✅ Yes | **Integration Test** | Verify category mapping |

**How to implement:**
```typescript
// Example test structure
describe('Basic Sync', () => {
  it('syncs single product with no variants', async () => {
    // Arrange: Mock Shopify API
    mockShopifyProducts([{
      id: 'gid://shopify/Product/1',
      title: 'Test Simple Product',
      variants: { edges: [{ node: { id: '...', sku: 'SIMPLE-001' } }] }
    }]);
    
    // Act: Run sync
    const result = await syncProducts(ctx);
    
    // Assert: Check DB state
    expect(result.productsCreated).toBe(1);
    const product = await db.query.products.findFirst({ where: ... });
    expect(product.name).toBe('Test Simple Product');
  });
});
```

---

## Phase 2: Re-Sync (No Changes)

| Test | Automatable? | Type | Implementation Notes |
|------|-------------|------|---------------------|
| 2.1 Re-sync Without Changes | ✅ Yes | **Integration Test** | Run sync twice, check skipped count |

**How to implement:**
```typescript
it('skips unchanged products on re-sync', async () => {
  // First sync
  await syncProducts(ctx);
  
  // Second sync (same data)
  const result = await syncProducts(ctx);
  
  expect(result.variantsSkipped).toBeGreaterThan(0);
  expect(result.variantsUpdated).toBe(0);
});
```

---

## Phase 3: Re-Sync (With Changes)

| Test | Automatable? | Type | Implementation Notes |
|------|-------------|------|---------------------|
| 3.1 Update Product Title | ✅ Yes | **Integration Test** | Change mock response, verify update |
| 3.2 Update Variant SKU | ✅ Yes | **Integration Test** | Change SKU in mock, verify DB |
| 3.3 Add New Variant | ✅ Yes | **Integration Test** | Add variant to mock response |
| 3.4 Remove Variant in Shopify | ✅ Yes | **Integration Test** | Remove from mock, verify orphan behavior |
| 3.5 Update Product Description | ✅ Yes | **Integration Test** | Change description, verify update |

---

## Phase 4: Field Configuration

| Test | Automatable? | Type | Implementation Notes |
|------|-------------|------|---------------------|
| 4.1 Disable Description Field | ✅ Yes | **Integration Test** | Pass fieldConfigs with disabled field |
| 4.2 Disable Attributes Field | ✅ Yes | **Integration Test** | Verify attributes not written |
| 4.3 Re-enable Description Field | ✅ Yes | **Integration Test** | Toggle config between syncs |
| 4.4 Disable SKU Field | ✅ Yes | **Integration Test** | Verify SKU unchanged |

**How to implement:**
```typescript
it('does not update description when field is disabled', async () => {
  // Setup: Create product with description
  const product = await createProduct({ description: 'Original' });
  
  // Sync with description disabled
  const ctx = createSyncContext({
    fieldConfigs: [
      { fieldKey: 'product.description', isEnabled: false, selectedSource: null }
    ]
  });
  mockShopifyProducts([{ ...product, description: 'New Description' }]);
  
  await syncProducts(ctx);
  
  // Verify description unchanged
  const updated = await getProduct(product.id);
  expect(updated.description).toBe('Original');
});
```

---

## Phase 5: Product Matching

| Test | Automatable? | Type | Implementation Notes |
|------|-------------|------|---------------------|
| 5.1 Match by SKU | ✅ Yes | **Integration Test** | Pre-create product, verify link created |
| 5.2 Match by Barcode | ✅ Yes | **Integration Test** | Pre-create product with barcode |
| 5.3 No Match (New Product) | ✅ Yes | **Integration Test** | Verify product creation |
| 5.4 Partial SKU Match | ✅ Yes | **Integration Test** | Complex setup, verify orphan behavior |

**How to implement:**
```typescript
it('matches existing product by SKU', async () => {
  // Pre-create Avelero product
  const existing = await createProduct({
    name: 'Manual Product',
    variants: [{ sku: 'MATCH-SKU-001' }]
  });
  
  // Mock Shopify product with same SKU
  mockShopifyProducts([{
    title: 'Shopify Product',
    variants: { edges: [{ node: { sku: 'MATCH-SKU-001' } }] }
  }]);
  
  const result = await syncProducts(ctx);
  
  // Should not create new product
  expect(result.productsCreated).toBe(0);
  
  // Should link to existing
  const link = await getProductLink(existing.id);
  expect(link).toBeDefined();
});
```

---

## Phase 6: Edge Cases

| Test | Automatable? | Type | Implementation Notes |
|------|-------------|------|---------------------|
| 6.1 Null Values in Shopify | ✅ Yes | **Integration Test** | Mock null description, verify preserved |
| 6.2 Same SKU Different Attributes | ✅ Yes | **Integration Test** | Verify attribute replacement |
| 6.3 Product Deleted in Shopify | ✅ Yes | **Integration Test** | Remove from mock, verify orphan |
| 6.4 Duplicate SKU in Shopify | ✅ Yes | **Integration Test** | Document and test actual behavior |
| 6.5 Very Long Product Name | ✅ Yes | **Unit Test** | Test `truncateString` function |
| 6.6 Special Characters | ✅ Yes | **Unit Test** + **Integration** | Test transforms + full sync |

**Unit test for truncation:**
```typescript
describe('truncateString', () => {
  it('truncates strings over 255 characters', () => {
    const long = 'A'.repeat(300);
    expect(truncateString(long, 255).length).toBe(255);
  });
});
```

---

## Phase 7: Multi-Sync Scenarios

| Test | Automatable? | Type | Implementation Notes |
|------|-------------|------|---------------------|
| 7.1 Create → Sync → Edit → Re-sync | ✅ Yes | **Integration Test** | Multi-step test with DB edits |
| 7.2 Multiple Syncs in Succession | ✅ Yes | **Integration Test** | Run sync 3x, verify no duplicates |
| 7.3 Disconnect → Reconnect | ⚠️ Partial | **Integration Test** | Can test matching logic, not OAuth |

---

## Phase 8: Performance & Limits

| Test | Automatable? | Type | Implementation Notes |
|------|-------------|------|---------------------|
| 8.1 Sync 100+ Products | ✅ Yes | **Integration Test** | Generate large mock dataset |
| 8.2 Product with 50+ Variants | ✅ Yes | **Integration Test** | Generate variant combinations |
| 8.3 500 Variant Limit | ✅ Yes | **Integration Test** | Test limit enforcement |

---

## Automation Summary

| Category | Total Tests | Automatable | Unit Tests | Integration Tests | Manual Only |
|----------|------------|-------------|------------|-------------------|-------------|
| Phase 1: Basic Sync | 6 | 6 | 0 | 6 | 0 |
| Phase 2: Re-Sync (No Changes) | 1 | 1 | 0 | 1 | 0 |
| Phase 3: Re-Sync (With Changes) | 5 | 5 | 0 | 5 | 0 |
| Phase 4: Field Configuration | 4 | 4 | 0 | 4 | 0 |
| Phase 5: Product Matching | 4 | 4 | 0 | 4 | 0 |
| Phase 6: Edge Cases | 6 | 6 | 2 | 4 | 0 |
| Phase 7: Multi-Sync | 3 | 3 | 0 | 3 | 0 |
| Phase 8: Performance | 3 | 3 | 0 | 3 | 0 |
| **TOTAL** | **32** | **32 (100%)** | **2** | **30** | **0** |

---

## Recommended Test Implementation

### Priority 1: Core Sync Logic (Must Have)
1. Basic product sync with variants
2. Hash-based change detection (skip unchanged)
3. Field configuration (enable/disable)
4. SKU/barcode matching
5. Null value handling

### Priority 2: Edge Cases (Should Have)
1. Partial SKU match (orphan behavior)
2. Attribute replacement
3. Truncation and transforms
4. Multiple syncs (no duplicates)

### Priority 3: Performance (Nice to Have)
1. Large batch handling
2. Variant limit enforcement
3. Progress tracking

---

## Test Infrastructure Requirements

To implement automated tests, you'll need:

1. **Test Database**
   - Separate PostgreSQL instance for tests
   - Migration runner in test setup
   - Cleanup between tests

2. **Mock Shopify API**
   - Intercept `fetch` calls to Shopify GraphQL
   - Factory functions to generate mock products
   - Support for pagination (multiple batches)

3. **Test Utilities**
   ```typescript
   // packages/integrations/src/__tests__/utils.ts
   export function mockShopifyProducts(products: MockProduct[]) { ... }
   export function createSyncContext(overrides: Partial<SyncContext>) { ... }
   export function assertProductState(productId: string, expected: ExpectedState) { ... }
   ```

4. **Test Runner**
   - Vitest (already common in the ecosystem)
   - Add to `packages/integrations/package.json`

---

## Next Steps

1. [ ] Set up test database configuration
2. [ ] Create mock Shopify API utilities
3. [ ] Write first integration test (Test 1.1)
4. [ ] Add test scripts to package.json
5. [ ] Set up CI to run integration tests
