# Structure Alignment Gaps

## Summary
The current structure is **partially aligned** with the proposed structure. We have the foundation in place, but several files still need to be split further.

## ✅ Completed (Matches Proposed)

### Core Structure
- ✅ `_shared/` - All helpers created (authz, pagination, sql, patch, selection)
- ✅ `catalog/` - All entity files split correctly
- ✅ `taxonomy/` - Categories file created
- ✅ `brand/` - All brand files split correctly
- ✅ `user/` - Users file created
- ✅ `dpp/public.ts` and `dpp/carousel.ts` - Created

## ❌ Missing (Needs Completion)

### 1. products/ - Major Split Needed
**Current:** All 21 functions still in `products.ts` (1945 lines)

**Needs:**
- ❌ Rename `_shared/filters.ts` → `_shared/where.ts`
- ❌ Create `list.ts` with:
  - `listProducts()`
  - `listProductIds()`
  - `listProductsWithIncludes()`
  - `listProductsForCarouselSelection()`
- ❌ Create `get.ts` with:
  - `getProduct()`
  - `getProductByHandle()`
  - `getProductWithIncludes()`
- ❌ Create `crud.ts` with:
  - `createProduct()`
  - `updateProduct()`
  - `deleteProduct()`
- ❌ Create `variants.ts` with:
  - `listVariantsForProduct()`
- ❌ Create `attributes.ts` with:
  - `upsertProductMaterials()`
  - `setProductEcoClaims()`
  - `upsertProductEnvironment()`
  - `setProductJourneySteps()`
  - `setProductTags()`
- ❌ Create `bulk.ts` with:
  - `bulkDeleteProductsByFilter()`
  - `bulkUpdateProductsByFilter()`
  - `bulkUpdateProductsByIds()`
  - `bulkDeleteProductsByIds()`
  - `countProductsByFilter()`

### 2. bulk/ - Needs Further Splitting

**Current:** 
- `bulk/import.ts` (612 lines) - Contains jobs, rows, and unmapped functions
- `bulk/staging.ts` (1041 lines) - Contains insert, preview, commit, cleanup functions
- `value-mappings.ts` at root level

**Needs:**
- ❌ Create `bulk/import/jobs.ts` with:
  - `createImportJob()`
  - `updateImportJobStatus()`
  - `updateImportJobProgress()`
  - `getImportJobStatus()`
- ❌ Create `bulk/import/rows.ts` with:
  - `createImportRows()`
  - `updateImportRowStatus()`
  - `batchUpdateImportRowStatus()`
  - `getImportErrors()`
  - `getFailedRowsForExport()`
  - `getImportRowCountsByStatus()`
- ❌ Create `bulk/import/unmapped.ts` with:
  - `getUnmappedValuesForJob()`
- ❌ Create `bulk/import/index.ts` - Barrel export
- ❌ Create `bulk/staging/insert.ts` with:
  - `insertStagingProduct()`
  - `batchInsertStagingProducts()`
  - `insertStagingVariant()`
  - `batchInsertStagingVariants()`
  - `insertStagingMaterials()`
  - `insertStagingEcoClaims()`
  - `insertStagingJourneySteps()`
  - `insertStagingEnvironment()`
- ❌ Create `bulk/staging/preview.ts` with:
  - `getStagingPreview()`
- ❌ Create `bulk/staging/commit.ts` with:
  - `countStagingProductsByAction()`
  - `getStagingProductsForCommit()`
  - `bulkCreateProductsFromStaging()`
- ❌ Create `bulk/staging/cleanup.ts` with:
  - `deleteStagingDataForJob()`
- ❌ Create `bulk/staging/index.ts` - Barrel export
- ❌ Move `value-mappings.ts` → `bulk/value-mappings.ts`

### 3. dpp/ - Missing Transform File

**Current:** `transformToDppData()` is in `dpp/public.ts`

**Needs:**
- ❌ Create `dpp/transform.ts` with:
  - `transformToDppData()`
  - Any other transform/formatting helpers

### 4. integrations/ - Needs Provider Split and Links Reorganization

**Current:**
- `integrations/connections.ts` contains provider functions + connection functions
- `integrations/links.ts` contains all link types (1178 lines)

**Needs:**
- ❌ Create `integrations/providers.ts` with:
  - `listAvailableIntegrations()`
  - `getIntegrationBySlug()`
  - `getIntegrationById()`
- ❌ Move connection functions to keep in `connections.ts`:
  - `listBrandIntegrations()`
  - `getBrandIntegration()`
  - `getBrandIntegrationBySlug()`
  - `createBrandIntegration()`
  - `updateBrandIntegration()`
  - `deleteBrandIntegration()`
  - `listIntegrationsDueForSync()`
- ❌ Create `integrations/links/product-links.ts` with product link functions
- ❌ Create `integrations/links/variant-links.ts` with variant link functions
- ❌ Create `integrations/links/entity-links.ts` with generic entity link helpers + thin wrappers
- ❌ Create `integrations/links/oauth-states.ts` with OAuth state functions
- ❌ Create `integrations/links/index.ts` - Barrel export

## Priority Order

1. **High Priority:** products/ split (largest file, most duplication)
2. **Medium Priority:** bulk/ split (large files, clear separation)
3. **Low Priority:** dpp/transform.ts (small move)
4. **Low Priority:** integrations/ reorganization (already somewhat organized)

