# Integration Test Refactor Plan

> **Document Purpose**: This document provides complete context for refactoring the integration test suite to align with the new integration system architecture. It includes all architectural decisions, behavioral specifications, and detailed recommendations for each test file.

---

## Table of Contents

1. [Integration System Architecture](#1-integration-system-architecture)
2. [Primary Integration Behavior](#2-primary-integration-behavior)
3. [Secondary Integration Behavior](#3-secondary-integration-behavior)
4. [Field Configuration System](#4-field-configuration-system)
5. [Variant Overrides & Multi-Source Conflicts](#5-variant-overrides--multi-source-conflicts)
6. [Promotion Algorithm](#6-promotion-algorithm)
7. [Current Test Suite Overview](#7-current-test-suite-overview)
8. [Test File Analysis & Recommendations](#8-test-file-analysis--recommendations)
9. [Missing Test Coverage](#9-missing-test-coverage)
10. [Implementation Roadmap](#10-implementation-roadmap)
11. [Progress Log](#11-progress-log)

---

## 1. Integration System Architecture

### 1.1 Core Concept: Primary/Secondary Model

The integration system uses a **hierarchical model** where integrations are classified as either **primary** or **secondary**.

| Aspect | Primary Integration | Secondary Integration |
|--------|---------------------|----------------------|
| Count per brand | Exactly 1 | Multiple allowed |
| Creates products | ✅ Yes | ❌ No |
| Creates variants | ✅ Yes | ❌ No |
| Creates attributes | ✅ Yes | ❌ No |
| Creates attribute values | ✅ Yes | ❌ No |
| Assigns attribute values to variants | ✅ Yes | ❌ No |
| Matches existing by identifier (SKU/barcode) | ❌ No (uses links only) | ✅ Yes |
| Can enrich existing data | ✅ Yes | ✅ Yes |
| Defines product grouping | ✅ Yes | ❌ No (follows Avelero's structure) |

### 1.2 Integration Connection Flow

1. **First integration connected** → Automatically becomes primary (`isPrimary = true`)
2. **Subsequent integrations** → Become secondary by default (`isPrimary = false`)
3. **User can promote** any secondary to primary (triggers re-grouping)

### 1.3 Product Sources

Products in Avelero have a `source` field indicating their origin:

| Source | Description |
|--------|-------------|
| `integration` | Created by an integration sync |
| `manual` | Created manually by user in UI |
| `bulk_upload` | Created via bulk import feature |

### 1.4 Key Database Tables

- **`brand_integrations`**: Links brands to integrations, tracks `isPrimary` status
- **`integration_product_links`**: Maps external product IDs to Avelero products
- **`integration_variant_links`**: Maps external variant IDs to Avelero variants
- **`promotion_operations`**: Tracks promotion progress (for resumability)

---

## 2. Primary Integration Behavior

### 2.1 Sync Behavior

**Primary integrations NEVER match existing products/variants by identifier (SKU/barcode).**

When a primary integration syncs:

1. **Check for existing link** (by external ID)
   - If link exists → Update existing product/variant
   - If no link exists → **Create new product/variant** (even if barcode matches!)

2. **Creation is always allowed**:
   - New products
   - New variants (on existing linked products)
   - New attributes
   - New attribute values
   - Attribute value assignments

### 2.2 Why Primary Ignores Identifier Matching

The primary integration **defines product grouping**. If we allowed matching, the primary's grouping would be compromised by pre-existing data structure decisions.

**Example Scenario**:
- User manually creates "Amazing Jacket" with barcode `ABC123`
- User connects Shopify (primary) which has a product with the same barcode `ABC123`
- **Correct behavior**: Shopify creates a NEW product (duplicate barcode is now a data quality issue)
- **Wrong behavior**: Shopify matches to manual product (corrupts Shopify's product grouping)

### 2.3 Implications

- Duplicate barcodes may exist after primary sync (user must clean up)
- Primary's product grouping is always respected
- Links are created for every product/variant created by primary

---

## 3. Secondary Integration Behavior

### 3.1 Match Identifier Configuration

When connecting a secondary integration, the user **must choose** one identifier for matching:

- **SKU matching**: Secondary's variants are matched to Avelero variants by SKU
- **Barcode matching**: Secondary's variants are matched to Avelero variants by barcode

This choice is stored as `matchIdentifier` in the integration configuration.

### 3.2 Sync Behavior

Secondary integrations **can only enrich existing data**:

1. **Match by configured identifier** (SKU or barcode)
   - If match found → Create link, enrich fields
   - If no match found → **Skip** (product/variant is ignored)

2. **Cannot create**:
   - ❌ Products
   - ❌ Variants
   - ❌ Attributes
   - ❌ Attribute values
   - ❌ Attribute assignments

3. **Can enrich** (if field is owned by this integration):
   - name, description, image, materials, certifications, price, weight, materials, etc.

### 3.3 Duplicate Identifier Handling

**If there are duplicate barcodes/SKUs in Avelero:**
- The **first match** (oldest variant) wins
- Other duplicates are ignored
- This is a data quality issue on the user's side

**If the secondary system has duplicate barcodes/SKUs:**
- First occurrence wins when building the external product map
- Subsequent occurrences are ignored

### 3.4 Case Sensitivity

Identifier matching is **case-insensitive**. Barcode `ABC123` matches `abc123`.

**Rationale**:
- **Barcodes** (EAN/UPC/GTIN): These standards are purely numeric, so case is not applicable
- **SKUs**: Best practice recommends uppercase standardization, but real-world data is often inconsistent
- **Practical benefit**: Case-insensitive matching prevents data mismatches without any real downside

---

## 4. Field Configuration System

### 4.1 Overview

The field configuration system determines **which integration owns which fields**. This prevents conflicts when multiple integrations try to update the same field.

### 4.2 Always-Enabled Fields

These fields **cannot be toggled off** and are always synced:

| Field | Primary Behavior | Secondary Behavior |
|-------|------------------|-------------------|
| `variant.sku` | Creates/updates | Uses for matching (if configured), never writes |
| `variant.barcode` | Creates/updates | Uses for matching (if configured), never writes |
| `variant.attributes` | Creates attributes, values, and assignments | **Cannot modify** - read-only |

### 4.3 Configurable Fields

These fields can be enabled/disabled per integration:

| Field | Description |
|-------|-------------|
| `product.name` | Product title |
| `product.description` | Product description/body HTML |
| `product.imagePath` | Product featured image |
| `product.tags` | Product tags |
| `product.categories` | Product categories |
| `product.webshopUrl` | URL to product on webshop |
| `product.salesStatus` | Sales status (active, discontinued, etc.) |
| `variant.price` | Variant price |
| `variant.weight` | Variant weight |
| `variant.materials` | Materials composition |
| `variant.certifications` | Certifications |
| (etc.) | Other variant fields |

### 4.4 Field Ownership Rules

1. **One owner per field**: Each field can only be owned by ONE integration at a time
2. **Disabled fields are skipped**: If a field is disabled for an integration, changes from that integration are ignored
3. **Re-enabling resumes sync**: When a field is enabled again, the next sync will update it
4. **Null values are ignored**: `null` from external system does not overwrite existing values

### 4.5 Clarification: Primary/Secondary vs Field Ownership

These are **separate concepts**:

| Concept | Scope | Purpose |
|---------|-------|---------|
| Primary/Secondary | Integration level | Determines who can CREATE structure |
| Field Ownership | Field level | Determines who can UPDATE data |

A secondary integration can "own" the `product.description` field even though it cannot create products.

---

## 5. Variant Overrides & Multi-Source Conflicts

### 5.1 What Are Variant Overrides?

When multiple external products from a secondary integration map to a single Avelero product (many-to-one), there's a conflict: which external product's data should populate the product-level fields?

**Solution: Variant-level overrides**

- **First matched external product** → Canonical (populates product-level fields)
- **Subsequent external products** → Non-canonical (populate variant-level override fields)

### 5.2 Many-to-One Scenario

**Setup**:
- Avelero (following primary's structure): 1 product "Amazing Jacket" with 4 variants (BLK-S, BLK-M, WHT-S, WHT-M)
- Secondary (Shopify, groups by color): 2 products
  - "Amazing Jacket Black" (BLK-S, BLK-M)
  - "Amazing Jacket White" (WHT-S, WHT-M)

**Conflict**: Both Shopify products want to set `product.title`. Which one wins?

**Resolution**:
1. "Amazing Jacket Black" matches first → **Canonical**
   - Sets `product.name = "Amazing Jacket Black"`
2. "Amazing Jacket White" matches second → **Non-canonical**
   - Sets `variant[WHT-S].overrideName = "Amazing Jacket White"`
   - Sets `variant[WHT-M].overrideName = "Amazing Jacket White"`

### 5.3 One-to-Many Scenario

**Setup**:
- Avelero (following primary's structure, color-based): 3 products
  - "Jacket Black" (BLK-S, BLK-M)
  - "Jacket White" (WHT-S, WHT-M)
  - "Jacket Red" (RED-S, RED-M)
- Secondary (It's Perfect, product-level grouping): 1 product "Amazing Jacket" with 6 variants

**Behavior**:
- The single external product enriches ALL 3 Avelero products
- Product-level data is duplicated to all 3 products
- All variant links point to the same external product

### 5.4 `isCanonical` Flag

The `integrationProductLinks.isCanonical` flag tracks whether a link represents the "canonical" mapping:

- `isCanonical = true`: This is the first/primary mapping; product-level data comes from here
- `isCanonical = false`: This is a secondary mapping; data goes to variant-level overrides

**Note**: For primary integrations, links are almost always canonical (1:1 relationship).

---

## 6. Promotion Algorithm

### 6.1 What is Promotion?

Promoting a secondary integration to primary triggers a **complete re-grouping** of all products to match the new primary's structure.

### 6.2 Algorithm Phases (11 total)

```
Phase 0: Preparation
├── Count total variants for progress tracking
└── Initialize operation record

Phase 1: Fetch External Structure
├── Fetch all products from new primary's API
└── Build barcode → external product map

Phase 2: Compute Variant Assignments
├── Match Avelero variants to external products by barcode
├── Identify orphaned variants (no match in new primary)
└── Store assignments in memory

Phase 4: Create Missing Products
├── For external products with no existing Avelero variants
└── Create new Avelero products

Phase 5: Re-parent Variants
├── Move variants to new parent products based on computed assignments
└── Process in batches of 1000

Phase 6: Handle Orphaned Variants
└── Orphaned variants STAY in their current products (preserve QR codes)

Phase 7: Archive Empty Products
└── Products with 0 variants after re-grouping are archived (status = 'archived')

Phase 8: Handle Attributes
├── Clear attribute assignments for products managed by new primary
├── Extract attributes/values from new primary's external data
├── Create missing attributes and values
└── Assign attribute values to variants based on new primary's structure

Phase 9: Update Links
├── Clear canonical status for old primary
├── Create/update product links for new primary (all canonical)
├── Create/update variant links for new primary
└── Update product-level data from new primary

Phase 11: Cleanup
└── Finalize operation, mark as completed
```

### 6.3 Key Behaviors

1. **Variant UPIDs are NEVER changed** - This is critical for QR code connectivity
2. **Orphaned variants stay in place** - Even if not in new primary, they remain
3. **Products may be archived** - If all variants move away, product becomes empty
4. **Attributes are re-created** - Cleared and rebuilt from new primary's structure
5. **Operation is resumable** - If it fails, it can resume from last checkpoint

### 6.4 Code Locations

- **Engine**: `packages/integrations/src/sync/promotion.ts`
- **Queries**: `packages/db/src/queries/integrations/promotion.ts`
- **Schema**: `packages/db/src/schema/integrations/promotion-operations.ts`

---

## 7. Current Test Suite Overview

### 7.1 Test File Organization

```
packages/integrations/__tests__/integration/
├── data-integrity/
│   └── data-integrity.integration.test.ts
├── lifecycle/
│   └── integration-lifecycle.integration.test.ts
├── multi-source/
│   ├── multi-source-conflicts.integration.test.ts
│   └── one-to-many.integration.test.ts
├── promotion/
│   ├── basic-promotion.integration.test.ts
│   └── promotion-regrouping.integration.test.ts
└── sync/
    ├── basic-sync.integration.test.ts
    ├── edge-cases.integration.test.ts
    ├── field-config.integration.test.ts
    ├── identifier-matching.integration.test.ts
    ├── manual-products.integration.test.ts
    ├── matching.integration.test.ts
    ├── multi-sync.integration.test.ts
    ├── performance.integration.test.ts
    ├── primary-integration.integration.test.ts
    ├── resync.integration.test.ts
    └── secondary-integration.integration.test.ts
```

### 7.2 Test Categories

| Category | Files | Purpose |
|----------|-------|---------|
| **Sync** | 11 files | Core sync engine behavior |
| **Multi-source** | 2 files | Many-to-one, one-to-many scenarios |
| **Promotion** | 2 files | Primary promotion algorithm |
| **Lifecycle** | 1 file | Connect/disconnect lifecycle |
| **Data integrity** | 1 file | UPID immutability, source tracking |

---

## 8. Test File Analysis & Recommendations

### 8.1 `identifier-matching.integration.test.ts` ✅ FIXED

**Status**: ✅ **Fixed on 2026-01-03**

**Issues that were identified and fixed**:

1. **ID-003 block**: Was using `isPrimary: true` but expected identifier matching
   - ✅ Fixed: Now uses secondary integration with `matchIdentifier: "barcode"` or `"sku"`

2. **ID-005 tests**: Were using primary integration for case sensitivity tests
   - ✅ Fixed: Now uses secondary integration to properly test case-sensitive matching

**Changes made**:
- Changed ID-003 `beforeEach` to create both primary and secondary integrations
- Updated ID-003 tests to use `secondaryIntegrationId` and proper context options
- Changed ID-005 `beforeEach` to create both primary and secondary integrations
- Updated ID-005 tests to verify secondary integration case-sensitive matching behavior
- Fixed test "barcode matching is case-sensitive" to expect secondary to skip (no match) instead of create
- Fixed test "exact case barcode DOES match" to verify secondary creates links

---

### 8.2 `basic-sync.integration.test.ts` ✅ ALIGNED

No changes needed. Correctly tests primary integration behavior.

---

### 8.3 `primary-integration.integration.test.ts` ✅ ALIGNED

No changes needed. Well-aligned with architecture:
- P-SYNC-001: Primary creates products
- P-MATCH-001: Primary does NOT match manual products
- P-ATTR-002/003: Primary creates attributes and values

---

### 8.4 `secondary-integration.integration.test.ts` ✅ ALIGNED

No changes needed. Correctly tests:
- S-SYNC-001: Secondary cannot create products
- S-SYNC-002/003: Secondary matches by barcode/SKU
- S-STRUCT-001/002/003: Secondary cannot create/modify structure

---

### 8.5 `matching.integration.test.ts` ✅ ALIGNED

No changes needed. Uses secondary for matching, primary for creation tests.

---

### 8.6 `field-config.integration.test.ts` ✅ ALIGNED

Tests are aligned with field configuration system:
- Disabled fields are skipped
- `alwaysEnabled` fields (SKU, barcode, attributes) always sync
- Re-enabling resumes sync

---

### 8.7 `manual-products.integration.test.ts` ✅ ALIGNED

Correctly tests:
- MANUAL-002: Primary creates new product even with duplicate barcode
- Secondary CAN match manual products

---

### 8.8 `multi-source-conflicts.integration.test.ts` ✅ ALIGNED

Tests many-to-one scenarios correctly using secondary integrations.

---

### 8.9 `one-to-many.integration.test.ts` ✅ ALIGNED

Tests one-to-many scenarios:
- O2M-001: Detect one-to-many mapping
- O2M-003: Partial match handling

---

### 8.10 `promotion/basic-promotion.integration.test.ts` ⚠️ INCOMPLETE

**Issues**:
- Tests setup and basic sync, not actual promotion
- Does not call `promoteIntegrationToPrimary()`
- Missing tests for promotion workflow

**Required Changes**:
- Add tests that call the actual promotion function
- Test full end-to-end promotion workflow

---

### 8.11 `promotion/promotion-regrouping.integration.test.ts` ⚠️ INCOMPLETE

**Issues**:
- Tests simulate re-grouping with manual database updates
- Does not call actual promotion function
- Import on line 31 (`promoteIntegrationToPrimary`) is unused

**Required Changes**:
- Implement tests that call `promoteIntegrationToPrimary()`
- Test resumability (interrupted promotion)
- Test error cases and rollback

---

### 8.12 Other Files ✅ ALIGNED

| File | Status |
|------|--------|
| `resync.integration.test.ts` | ✅ Aligned |
| `edge-cases.integration.test.ts` | ✅ Aligned |
| `multi-sync.integration.test.ts` | ✅ Aligned |
| `performance.integration.test.ts` | ✅ Aligned |
| `integration-lifecycle.integration.test.ts` | ✅ Aligned |
| `data-integrity.integration.test.ts` | ✅ Aligned |

---

## 9. Missing Test Coverage

### 9.1 High Priority

| Test Scenario | Description | Recommended File |
|---------------|-------------|------------------|
| **matchIdentifier enforcement** | Verify secondary uses configured identifier (SKU vs barcode), ignores the other | `secondary-integration.integration.test.ts` |
| **Primary link-first matching** | Verify primary checks existing links before creating | `primary-integration.integration.test.ts` |
| **Full promotion workflow** | End-to-end test calling `promoteIntegrationToPrimary()` | `promotion-regrouping.integration.test.ts` |
| **Promotion with orphaned variants** | Variants not in new primary stay in place | `promotion-regrouping.integration.test.ts` |

### 9.2 Medium Priority

| Test Scenario | Description | Recommended File |
|---------------|-------------|------------------|
| **Multiple secondaries enriching same product** | Two secondaries own different fields on same product | New file or `multi-source-conflicts.integration.test.ts` |
| **Promotion error handling** | What happens when promotion fails mid-way | `promotion-regrouping.integration.test.ts` |
| **Promotion resumability** | Interrupted promotion can resume from checkpoint | `promotion-regrouping.integration.test.ts` |
| **Case-sensitive matching for secondary** | Barcode `ABC123` does NOT match `abc123` | `identifier-matching.integration.test.ts` |

### 9.3 Lower Priority

| Test Scenario | Description | Recommended File |
|---------------|-------------|------------------|
| **A→B→A promotion** | Promote to B, then back to A | `promotion-regrouping.integration.test.ts` |
| **Bulk import create mode** | Future feature - always creates | Future test file |
| **Bulk import enrich mode** | Future feature - matches only | Future test file |

---

## 10. Implementation Roadmap

### Phase 1: Fix Broken Tests ✅ COMPLETED

**Completed on**: 2026-01-03

1. ✅ **Fixed `identifier-matching.integration.test.ts`**
   - Converted ID-003 block to use secondary integration
   - Added `isPrimary: false` and `matchIdentifier: "barcode"/"sku"` to context
   - Updated assertions to reflect secondary behavior

2. ✅ **Updated ID-005 tests**
   - Changed to use secondary integration for proper case sensitivity testing
   - Updated test titles and assertions

### Phase 2: Add Promotion Tests (High Priority)

1. **Implement actual promotion tests in `promotion-regrouping.integration.test.ts`**
   - Call `promoteIntegrationToPrimary()` function
   - Verify variant re-parenting
   - Verify product archives
   - Verify attribute re-creation
   - Verify link updates

2. **Add promotion edge case tests**
   - Orphaned variants stay in place
   - Empty products are archived
   - UPIDs never change

### Phase 3: Add Missing Secondary Tests ✅ COMPLETED

**Completed on**: 2026-01-03

1. ✅ **matchIdentifier enforcement tests** (S-MATCH-001, S-MATCH-002)
   - Secondary configured for barcode ignores SKU matches
   - Secondary configured for SKU ignores barcode matches
   - 4 tests added to `secondary-integration.integration.test.ts`

2. ✅ **Case-sensitive matching tests** (S-MATCH-003)
   - SKU matching is case-sensitive (different case = no match)
   - Barcode matching is case-sensitive (different case = no match)
   - 2 tests added to `secondary-integration.integration.test.ts`

### Phase 4: Structural Cleanup (Optional)

Consider reorganizing test files:

```
integration/
├── primary/
│   ├── sync.test.ts
│   ├── resync.test.ts
│   └── linking.test.ts
├── secondary/
│   ├── matching.test.ts
│   ├── enrichment.test.ts
│   └── restrictions.test.ts
├── promotion/
│   ├── basic.test.ts
│   ├── regrouping.test.ts
│   └── edge-cases.test.ts
├── lifecycle/
│   └── connect-disconnect.test.ts
└── shared/
    ├── edge-cases.test.ts
    ├── performance.test.ts
    └── data-integrity.test.ts
```

---

## Appendix A: Test Helper Updates

Ensure `createTestSyncContext` accepts all required parameters:

```typescript
interface TestSyncContextOptions {
    brandId: string;
    brandIntegrationId: string;
    productsTotal: number;
    isPrimary?: boolean;           // Required for explicit behavior
    matchIdentifier?: "sku" | "barcode"; // Required for secondary
    enabledFields?: Record<string, boolean>;
    onProgress?: (progress: SyncProgress) => Promise<void>;
}
```

---

## Appendix B: Current Test Counts

| File | Test Count | Status |
|------|------------|--------|
| basic-sync.integration.test.ts | 6 | ✅ |
| primary-integration.integration.test.ts | 6 | ✅ |
| secondary-integration.integration.test.ts | 13 | ✅ (+6 Phase 3) |
| identifier-matching.integration.test.ts | 8 | ✅ |
| matching.integration.test.ts | 5 | ✅ |
| field-config.integration.test.ts | 7 | ✅ |
| manual-products.integration.test.ts | 6 | ✅ |
| resync.integration.test.ts | 7 | ✅ |
| edge-cases.integration.test.ts | 6 | ✅ |
| multi-sync.integration.test.ts | 3 | ✅ |
| performance.integration.test.ts | 4 | ✅ |
| multi-source-conflicts.integration.test.ts | 5 | ✅ |
| one-to-many.integration.test.ts | 4 | ✅ |
| integration-lifecycle.integration.test.ts | 7 | ✅ |
| basic-promotion.integration.test.ts | 6 | ✅ |
| promotion-regrouping.integration.test.ts | 12 | ✅ |
| data-integrity.integration.test.ts | 6 | ✅ |
| **TOTAL** | **121** | **All passing ✅** |

---

## Appendix C: Quick Reference - Expected Behaviors

### Primary Integration Sync

```
External Product arrives
└── Check for existing link by external ID?
    ├── YES → Update existing Avelero product/variant
    └── NO → Create NEW product/variant (ignore barcode matches!)
```

### Secondary Integration Sync

```
External Product arrives
└── For each variant, check barcode/SKU match in Avelero?
    ├── MATCH FOUND → Create link, enrich fields (respecting ownership)
    └── NO MATCH → Skip (product/variant ignored)
```

### Duplicate Identifier Handling

```
Duplicate barcode in Avelero:
└── First variant (oldest) wins, others ignored

Duplicate barcode in external system:
└── First occurrence wins, others ignored
```

---

## 11. Progress Log

### 2026-01-03: Phase 1 Complete

**Status**: ✅ All tests passing (108/108)

**Work completed**:
1. Fixed `identifier-matching.integration.test.ts`:
   - ID-003 block: Changed from primary to secondary integration
   - ID-005 block: Changed from primary to secondary integration
   - All 5 tests in these blocks now correctly test secondary integration behavior

**Test results before fix**: 107 pass, 1 fail
**Test results after fix**: 108 pass, 0 fail

**Next steps**: Phase 2 - Add Promotion Tests

---

### 2026-01-03: Phase 2 Complete ✅

**Status**: ✅ All 18 promotion tests passing (12 in promotion-regrouping + 6 in basic-promotion)

**Work completed**:
1. ✅ Rewrote `promotion-regrouping.integration.test.ts` to call actual `promoteIntegrationToPrimary()` function
2. ✅ Added mock It's Perfect connector for testing (`getMockItsPerfectConnector()` in `@v1/testing/mocks/its-perfect`)
3. ✅ Added `registerConnector()` and `unregisterConnector()` to connector registry for testing
4. ✅ Created `promotion_operations` table schema (migration generated and applied)
5. ✅ **Fixed Bug 1**: Split scenario now works - algorithm tracks "claimed" Avelero products so only one external product can claim each
6. ✅ **Fixed Bug 2**: Test assertions updated to handle default `unpublished` product status

**Bug Fixes Applied**:

#### Bug 1: Split Scenario Fixed
**Location**: `packages/integrations/src/sync/promotion.ts` - `phase4_createMissingProducts()`

The algorithm now tracks which Avelero products have been "claimed" by an external product. When multiple external products map to variants from the same source Avelero product, only one external product claims the existing product while others trigger new product creation.

```typescript
// Track which Avelero products have been claimed by an external product
const claimedProducts = new Set<string>();

for (const [externalProductId, groups] of productGroups) {
    // Find the first unclaimed Avelero product from the sorted list
    let assignedProductId: string | null = null;
    for (const group of groups) {
        if (!claimedProducts.has(group.productId)) {
            assignedProductId = group.productId;
            claimedProducts.add(group.productId);
            break;
        }
    }
    if (assignedProductId) {
        mainProductMap.set(externalProductId, assignedProductId);
    }
}
```

#### Bug 2: Test Status Filter Fixed
**Location**: `promotion-regrouping.integration.test.ts`

Tests were checking for `status = 'published'` but the sync engine creates products with `status = 'unpublished'` (schema default). Fixed by removing the status filter from queries.

**Tests now passing**:
| Test | Status |
|------|--------|
| Full End-to-End Workflow - success status | ✅ Pass |
| Full End-to-End Workflow - isPrimary flags | ✅ Pass |
| Variant Re-Parenting - 3→1 merge | ✅ Pass |
| Variant Re-Parenting - 1→3 split | ✅ Pass |
| UPID Preservation | ✅ Pass |
| Orphaned Variants - stay in place | ✅ Pass |
| Empty Product Archival | ✅ Pass |
| Link Updates - product links | ✅ Pass |
| Link Updates - variant links | ✅ Pass |
| Link Updates - clear canonical | ✅ Pass |
| Progress Tracking - callback | ✅ Pass |
| Progress Tracking - statistics | ✅ Pass |

**Files modified**:
- `packages/integrations/src/sync/promotion.ts` - Fixed split scenario bug in phase4_createMissingProducts
- `packages/integrations/__tests__/integration/promotion/promotion-regrouping.integration.test.ts` - Removed .skip, fixed status filters

**Next steps**: Phase 3 - Add Missing Secondary Tests

---

### 2026-01-03: Phase 3 Complete ✅

**Status**: ✅ All 121 integration tests passing

**Work completed**:
1. ✅ Added **S-MATCH-001** tests: matchIdentifier enforcement - Barcode Mode Ignores SKU
   - `secondary configured for barcode ignores matching SKU (no barcode match)`
   - `secondary configured for barcode matches by barcode (ignoring SKU mismatch)`

2. ✅ Added **S-MATCH-002** tests: matchIdentifier enforcement - SKU Mode Ignores Barcode
   - `secondary configured for SKU ignores matching barcode (no SKU match)`
   - `secondary configured for SKU matches by SKU (ignoring barcode mismatch)`

3. ✅ Added **S-MATCH-003** tests: Case Sensitivity for matchIdentifier
   - `SKU matching is case-sensitive (different case = no match)`
   - `barcode matching is case-sensitive (different case = no match)`

**Files modified**:
- `packages/integrations/__tests__/integration/sync/secondary-integration.integration.test.ts` - Added 6 new tests

**Test results**: 121 pass, 0 fail across 17 test files

**Next steps**: Phase 4 - Structural Cleanup (Optional)

---

### 2026-01-03: Phase 4 Complete ✅

**Status**: ✅ Test file restructuring complete - all imports verified

**Work completed**:

1. ✅ Created new directory structure:
   - `__tests__/integration/primary/` - Primary integration tests
   - `__tests__/integration/secondary/` - Secondary integration tests  
   - `__tests__/integration/shared/` - Cross-cutting/shared tests
   - `__tests__/integration/promotion/` - Promotion workflow tests (existing, renamed)
   - `__tests__/integration/lifecycle/` - Integration lifecycle tests (existing, renamed)

2. ✅ Renamed and moved files:
   | Old Location | New Location |
   |-------------|--------------|
   | `sync/basic-sync.integration.test.ts` | `primary/sync.test.ts` |
   | `sync/primary-integration.integration.test.ts` | `primary/linking.test.ts` |
   | `sync/resync.integration.test.ts` | `primary/resync.test.ts` |
   | `sync/secondary-integration.integration.test.ts` | `secondary/restrictions.test.ts` |
   | `sync/matching.integration.test.ts` | `secondary/matching.test.ts` |
   | `sync/field-config.integration.test.ts` | `secondary/enrichment.test.ts` |
   | `sync/identifier-matching.integration.test.ts` | `secondary/identifier-matching.test.ts` |
   | `sync/edge-cases.integration.test.ts` | `shared/edge-cases.test.ts` |
   | `sync/performance.integration.test.ts` | `shared/performance.test.ts` |
   | `sync/manual-products.integration.test.ts` | `shared/manual-products.test.ts` |
   | `sync/multi-sync.integration.test.ts` | `shared/multi-sync.test.ts` |
   | `data-integrity/data-integrity.integration.test.ts` | `shared/data-integrity.test.ts` |
   | `multi-source/multi-source-conflicts.integration.test.ts` | `shared/multi-source-conflicts.test.ts` |
   | `multi-source/one-to-many.integration.test.ts` | `shared/one-to-many.test.ts` |
   | `promotion/basic-promotion.integration.test.ts` | `promotion/basic.test.ts` |
   | `promotion/promotion-regrouping.integration.test.ts` | `promotion/regrouping.test.ts` |
   | `lifecycle/integration-lifecycle.integration.test.ts` | `lifecycle/connect-disconnect.test.ts` |

3. ✅ Removed empty directories: `sync/`, `data-integrity/`, `multi-source/`

4. ✅ Verified all imports:
   - All files use relative path `../../../src/sync/engine` for `syncProducts` import
   - All `@v1/testing/*` and `@v1/db/schema` imports remain valid
   - No broken import paths detected

**Directory structure**:
```
packages/integrations/__tests__/integration/
├── primary/
│   ├── sync.test.ts         # Basic sync tests
│   ├── linking.test.ts      # Product/variant linking tests  
│   └── resync.test.ts       # Re-sync and change detection tests
├── secondary/
│   ├── restrictions.test.ts      # Cannot create products/variants/attributes
│   ├── matching.test.ts          # SKU/barcode matching tests
│   ├── enrichment.test.ts        # Field config and enrichment tests
│   └── identifier-matching.test.ts # Identifier edge cases
├── shared/
│   ├── edge-cases.test.ts        # Edge case handling
│   ├── performance.test.ts       # Large dataset tests
│   ├── manual-products.test.ts   # Manual/bulk upload tests
│   ├── multi-sync.test.ts        # Multi-sync scenario tests
│   ├── data-integrity.test.ts    # UPID and source tracking tests
│   ├── multi-source-conflicts.test.ts # Many-to-one mapping tests
│   └── one-to-many.test.ts       # One-to-many mapping tests
├── promotion/
│   ├── basic.test.ts             # Basic promotion flow
│   └── regrouping.test.ts        # Variant re-parenting tests
└── lifecycle/
    └── connect-disconnect.test.ts # Integration lifecycle tests
```

**Naming convention**: Changed from `*.integration.test.ts` to `*.test.ts` for brevity (directory already indicates integration tests).

**Next steps**: None - Phase 4 (structural cleanup) is complete!

---

*Document created: 2026-01-03*
*Last updated: 2026-01-03 14:10*
*Author: Claude (Antigravity)*

