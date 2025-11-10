# Bulk Import Error Classification Fix

## Problem Summary

The bulk import system is currently mislabeling **missing catalog values** (sizes, materials, categories) as **errors**, blocking import progress. However, these should be treated as **missing definitions** that trigger user interaction—similar to how manual import handles them.

### Current Behavior (Incorrect)
```
Row 1 | sku: SKU-TSH-58219 | ERROR: Size "L" not found in brand catalog
Row 2 | sku: SKU-TSH-18194 | ERROR: Size "2XL" not found in brand catalog
Row 4 | sku: SKU-DRS-58619 | ERROR: Category "Accessories" not found
```

All these rows are marked as **FAILED** and counted as errors, preventing import approval.

### Expected Behavior (Correct)
```
Row 1 | sku: SKU-TSH-58219 | NEEDS DEFINITION: Size "L" (will be created)
Row 2 | sku: SKU-TSH-18194 | NEEDS DEFINITION: Size "2XL" (will be created)  
Row 4 | sku: SKU-DRS-58619 | NEEDS DEFINITION: Category "Accessories" (will be created)
```

These rows should be marked as **VALIDATED** with pending user definitions. User creates missing values via UI, then proceeds with import.

---

## Root Cause Analysis

### 1. Validation Logic Issues

**File:** `packages/jobs/src/trigger/validate-and-stage.ts`

**Lines 810-840:**
```typescript
// Missing size - currently treated as UNMAPPED_VALUE error
if (!sizeResult.found) {
  trackUnmappedValue(unmappedValues, "SIZE", row.size_name);
  errors.push({
    type: "UNMAPPED_VALUE",
    field: "size_name",
    message: `Size "${row.size_name}" not found in brand catalog`,
  });
}

// Missing category - currently treated as FOREIGN_KEY_NOT_FOUND error
if (!categoryResult.found) {
  errors.push({
    type: "FOREIGN_KEY_NOT_FOUND",
    field: "category_name",
    message: `Category "${row.category_name}" not found`,
  });
}
```

**Problem:** Any error in the `errors` array causes the row to be marked as `FAILED` and excluded from staging.

### 2. Error Type Classification

Currently all validation issues are treated equally:
- `REQUIRED_FIELD_EMPTY` → blocks import ✅ (correct)
- `DUPLICATE_VALUE` → blocks import ✅ (correct)
- `FIELD_TOO_LONG` → blocks import ✅ (correct)
- `UNMAPPED_VALUE` → blocks import ❌ (should allow with user definition)
- `FOREIGN_KEY_NOT_FOUND` → blocks import ❌ (should allow with user definition)

### 3. Manual Import Comparison

**Manual import flow** (from `apps/app/src/components/passports/form/blocks/`):

```tsx
// MaterialsBlock - Missing material triggers sheet
<MaterialDropdown
  onCreateMaterial={(searchTerm) => handleCreateMaterial(searchTerm, material.id)}
/>

// OrganizationBlock - Missing size triggers modal
<SizeSelect
  onCreateNew={(initial, category) => {
    setPrefillSize(initial);
    setSizeModalOpen(true);
  }}
/>

// ColorSelect - Missing color auto-creates OR triggers picker
const handleCreateClick = () => {
  if (searchTerm) {
    setPendingColorName(searchTerm);
    setView("picker");
  }
};
```

**Key insight:** Manual import **allows** missing values and provides UI to create them inline. Bulk import should do the same.

---

## Solution Design

### A. New Error Classification System

Introduce **two-tier validation** with distinct outcomes:

#### Tier 1: Hard Errors (Block Import)
These prevent any import progress:
- `REQUIRED_FIELD_EMPTY` - Critical data missing (product_name, upid/sku)
- `DUPLICATE_VALUE` - Same UPID/SKU appears multiple times in file
- `FIELD_TOO_LONG` - String length exceeds database limits
- `INVALID_FORMAT` - Data format incompatible (e.g., invalid UUID)

**Outcome:** Row marked as `FAILED`, user must fix CSV and re-upload.

#### Tier 2: Needs Definition (Requires User Input)
These allow import to proceed after user creates missing entities:
- `NEEDS_DEFINITION_SIMPLE` - Auto-creatable entities (colors, eco-claims)
- `NEEDS_DEFINITION_COMPLEX` - Entities requiring user input (materials with certifications, sizes with categories)
- `NEEDS_DEFINITION_REFERENCE` - Missing foreign keys that can be created (categories, facilities)

**Outcome:** Row marked as `VALIDATED`, staged with NULL foreign keys, user creates entities via UI, commit applies mappings.

### B. Validation Logic Changes

**File:** `packages/jobs/src/trigger/validate-and-stage.ts`

```typescript
/**
 * New validation error types
 */
interface ValidationError {
  type: "HARD_ERROR" | "NEEDS_DEFINITION";
  subtype: string; // Specific error code
  field?: string;
  message: string;
  severity: "error" | "warning";
}

/**
 * Categorize entities by creation complexity
 */
enum EntityComplexity {
  SIMPLE_AUTO_CREATE = "SIMPLE_AUTO_CREATE",        // colors, eco-claims - auto create
  COMPLEX_USER_INPUT = "COMPLEX_USER_INPUT",        // materials (need certifications), sizes (need category)
  REFERENCE_USER_CREATE = "REFERENCE_USER_CREATE",  // categories, facilities - user must define
}

function getEntityComplexity(entityType: EntityType): EntityComplexity {
  switch (entityType) {
    case "COLOR":
    case "ECO_CLAIM":
      return EntityComplexity.SIMPLE_AUTO_CREATE;
    
    case "MATERIAL":
    case "SIZE":
      return EntityComplexity.COMPLEX_USER_INPUT;
    
    case "CATEGORY":
    case "FACILITY":
    case "SHOWCASE_BRAND":
    case "CERTIFICATION":
      return EntityComplexity.REFERENCE_USER_CREATE;
  }
}
```

**Updated validateRow logic:**

```typescript
// BEFORE (incorrect):
if (!sizeResult.found) {
  trackUnmappedValue(unmappedValues, "SIZE", row.size_name);
  errors.push({
    type: "UNMAPPED_VALUE",
    field: "size_name",
    message: `Size "${row.size_name}" not found in brand catalog`,
  });
}

// AFTER (correct):
let sizeId: string | null = null;
if (row.size_name) {
  const sizeResult = await valueMapper.mapSizeName(brandId, row.size_name, "size_name");
  
  if (!sizeResult.found) {
    // Track for user definition but DON'T block validation
    trackUnmappedValue(unmappedValues, "SIZE", row.size_name);
    
    // Add as warning, not error
    warnings.push({
      type: "NEEDS_DEFINITION",
      subtype: "MISSING_SIZE",
      field: "size_name",
      message: `Size "${row.size_name}" needs to be created`,
      severity: "warning",
    });
    
    // Leave sizeId as null - will be populated after user creates size
    sizeId = null;
  } else {
    sizeId = sizeResult.targetId;
  }
}
```

### C. Staging Table Updates

**Current constraint:** Staging tables likely have NOT NULL constraints on foreign keys.

**Required change:**
```sql
-- Allow NULL for optional catalog references
ALTER TABLE staging_variants 
  ALTER COLUMN color_id DROP NOT NULL,
  ALTER COLUMN size_id DROP NOT NULL;

ALTER TABLE staging_products
  ALTER COLUMN category_id DROP NOT NULL,
  ALTER COLUMN showcase_brand_id DROP NOT NULL,
  ALTER COLUMN brand_certification_id DROP NOT NULL;
```

**Rationale:** Rows can be staged with missing references, then populated after user creates entities.

### D. UI Flow Updates

**File:** `apps/app/src/components/import/unmapped-values-section.tsx`

Add clear visual distinction:

```tsx
// Group 1: Auto-created (informational)
<InfoCard variant="success">
  <Icons.CheckCircle2 />
  <h4>5 colors auto-created</h4>
  <p>These were automatically added: Red, Blue, Green, Yellow, Orange</p>
</InfoCard>

// Group 2: Need user definition (actionable)
<ActionCard variant="warning">
  <Icons.AlertCircle />
  <h4>12 sizes need definition</h4>
  <p>Create these sizes to proceed with import</p>
  <ValueList>
    {sizes.map(size => (
      <ValueItem key={size}>
        <span>{size}</span>
        <Button onClick={() => handleDefineSize(size)}>Create</Button>
      </ValueItem>
    ))}
  </ValueList>
</ActionCard>

// Group 3: Blocking errors (critical)
<ErrorCard variant="destructive">
  <Icons.XCircle />
  <h4>3 rows have critical errors</h4>
  <p>Fix these in your CSV and re-upload</p>
  <ErrorList>
    <li>Row 5: Product name is required</li>
    <li>Row 12: Duplicate SKU: SKU-123</li>
    <li>Row 18: Description exceeds 2000 characters</li>
  </ErrorList>
</ErrorCard>
```

### E. Import Flow State Machine

```
┌─────────────┐
│  CSV Upload │
└──────┬──────┘
       │
       ▼
┌─────────────┐    Hard errors found
│ VALIDATING  │──────────────────────▶ FAILED (user must fix CSV)
└──────┬──────┘
       │
       │ All validations pass (may have warnings)
       ▼
┌─────────────┐
│  VALIDATED  │◀───────────┐
└──────┬──────┘            │
       │                   │
       │ Has unmapped      │ User creates
       │ values            │ missing entity
       ▼                   │
┌─────────────┐            │
│ NEEDS_DEFS  │────────────┘
└──────┬──────┘
       │
       │ All values defined
       ▼
┌─────────────┐
│ READY       │──▶ User approves ──▶ COMMITTING ──▶ COMPLETED
└─────────────┘
```

---

## Implementation Plan

### Phase 1: Core Validation Changes
**Files to modify:**
1. `packages/jobs/src/trigger/validate-and-stage.ts`
   - Add `warnings` array alongside `errors`
   - Separate hard errors from warnings
   - Only mark row as FAILED if `errors.length > 0` (not warnings)
   - Track unmapped values without blocking validation

2. `packages/db/src/schema/data/staging-*.ts` (if needed)
   - Ensure foreign key columns allow NULL
   - Document that NULLs are temporary until user creates entities

### Phase 2: UI/UX Enhancements
**Files to modify:**
1. `apps/app/src/components/import/unmapped-values-section.tsx`
   - Add three-tier visual grouping (auto-created, needs-definition, errors)
   - Show row counts affected by each unmapped value
   - Provide clear CTAs for entity creation

2. `apps/app/src/components/import/import-review-content.tsx`
   - Update status badges to show "Needs Definition" state
   - Show progress: "8 of 12 values defined"
   - Enable approval only when all definitions complete

### Phase 3: Testing & Documentation
**Test scenarios:**
```csv
product_name,sku,size_name,color_name,category_name
T-Shirt A,SKU-001,L,Red,T-Shirts              ✓ Size missing, color auto-create
Jacket B,SKU-002,XL,Blue,Outerwear            ✓ All valid
Pants C,SKU-003,32,Black,Bottoms              ✓ Category missing
Dress D,SKU-004,,White,Dresses                ✓ Size empty (allowed)
,SKU-005,M,Green,Accessories                  ✗ Product name required (HARD ERROR)
Hoodie E,SKU-006,XXL,Red,T-Shirts             ✓ Size missing
Hoodie F,SKU-006,L,Blue,T-Shirts              ✗ Duplicate SKU (HARD ERROR)
```

**Expected outcome:**
- 5 rows validated (may have warnings)
- 2 rows failed (hard errors)
- Unmapped values:
  - Auto-created: Red (color), White, Green, Blue, Black
  - Needs definition: L, XL, 32, XXL (sizes); T-Shirts, Outerwear, Bottoms, Dresses, Accessories (categories)

---

## Migration Notes

### Backward Compatibility
- Existing imports in `FAILED` state due to missing catalog values should be retriable
- After deployment, users can re-validate those files and proceed

### Database Changes
- Run migration to allow NULL on staging foreign keys
- Add `warnings` JSONB column to `import_rows` if tracking detailed warnings
- Update `import_jobs.summary` to distinguish `hard_errors` vs `needs_definition`

### Documentation Updates
**Files to update:**
1. `BULK_API_RESTRUCTURE.md` - Add validation tiers section
2. `apps/api/public/templates/README.md` - Update error descriptions
3. `.docs/bulk-import-trigger-fix.md` - Cross-reference this doc
4. `claude.md` - Add validation best practices

---

## Code Examples

### Example 1: Updated Row Validation
```typescript
async function validateRow(
  row: CSVRow,
  brandId: string,
  rowNumber: number,
  jobId: string,
  valueMapper: ValueMapper,
  unmappedValues: Map<string, Set<string>>,
  duplicateRowNumbers: Set<number>,
  duplicateCheckColumn: string,
): Promise<ValidatedRowData> {
  const errors: ValidationError[] = [];    // Block import
  const warnings: ValidationWarning[] = []; // Need user action

  // HARD ERROR: Duplicate check
  if (duplicateRowNumbers.has(rowNumber)) {
    errors.push({
      type: "HARD_ERROR",
      subtype: "DUPLICATE_VALUE",
      field: duplicateCheckColumn,
      message: `Duplicate ${duplicateCheckColumn.toUpperCase()}`,
      severity: "error",
    });
  }

  // HARD ERROR: Required field
  if (!row.product_name?.trim()) {
    errors.push({
      type: "HARD_ERROR",
      subtype: "REQUIRED_FIELD_EMPTY",
      field: "product_name",
      message: "Product name is required",
      severity: "error",
    });
  }

  // WARNING: Missing size (needs definition)
  let sizeId: string | null = null;
  if (row.size_name) {
    const sizeResult = await valueMapper.mapSizeName(brandId, row.size_name, "size_name");
    if (!sizeResult.found) {
      trackUnmappedValue(unmappedValues, "SIZE", row.size_name);
      warnings.push({
        type: "NEEDS_DEFINITION",
        subtype: "MISSING_SIZE",
        field: "size_name",
        message: `Size "${row.size_name}" needs to be created`,
        severity: "warning",
      });
    } else {
      sizeId = sizeResult.targetId;
    }
  }

  // WARNING: Missing material (needs definition)
  if (row.material_1_name) {
    const materialResult = await valueMapper.mapMaterialName(brandId, row.material_1_name, "material_1_name");
    if (!materialResult.found) {
      trackUnmappedValue(unmappedValues, "MATERIAL", row.material_1_name);
      warnings.push({
        type: "NEEDS_DEFINITION",
        subtype: "MISSING_MATERIAL",
        field: "material_1_name",
        message: `Material "${row.material_1_name}" needs to be created`,
        severity: "warning",
      });
    }
  }

  // AUTO-CREATE: Missing color (simple entity)
  let colorId: string | null = null;
  if (row.color_name) {
    const colorResult = await valueMapper.mapColorName(brandId, row.color_name, "color_name");
    if (!colorResult.found) {
      colorId = await valueMapper.autoCreateColor(brandId, row.color_name);
      logger.info("Auto-created color", { colorName: row.color_name, colorId });
    } else {
      colorId = colorResult.targetId;
    }
  }

  // Determine action
  const action = existingProduct ? "UPDATE" : "CREATE";
  
  // Row is VALID if no hard errors (warnings are OK)
  const isValid = errors.length === 0;

  return {
    productId,
    variantId,
    action,
    product,
    variant,
    errors,      // Only hard errors here
    warnings,    // Needs-definition items here
    isValid,
  };
}
```

### Example 2: Updated Batch Processing
```typescript
// Insert valid rows into staging (even if they have warnings)
for (const item of validatedBatch) {
  // Check errors only, not warnings
  if (item.validated && item.validated.errors.length === 0) {
    try {
      // Insert staging product
      const stagingProductId = await insertStagingProduct(db, item.validated.product);
      
      // Insert staging variant
      await insertStagingVariant(db, {
        ...item.validated.variant,
        stagingProductId,
      });

      // Update import_row status to VALIDATED
      await batchUpdateImportRowStatus(db, [{
        id: item.importRowId,
        status: "VALIDATED",
        normalized: {
          action: item.validated.action,
          product_id: item.validated.productId,
          variant_id: item.validated.variantId,
        },
        warnings: item.validated.warnings, // Store warnings separately
      }]);
      
      validCount++;
    } catch (error) {
      // Handle staging errors...
      invalidCount++;
    }
  } else {
    // Hard errors only - mark as FAILED
    await batchUpdateImportRowStatus(db, [{
      id: item.importRowId,
      status: "FAILED",
      error: item.validated?.errors.map(e => e.message).join("; "),
    }]);
    invalidCount++;
  }
}
```

---

## Success Criteria

### Functional Requirements
- ✅ Rows with missing sizes are marked VALIDATED (not FAILED)
- ✅ Rows with missing materials are marked VALIDATED (not FAILED)
- ✅ Rows with missing categories can proceed if user creates them
- ✅ Colors are auto-created without user intervention
- ✅ Duplicate SKUs still block import (hard error)
- ✅ Missing required fields still block import (hard error)

### User Experience
- ✅ Clear distinction between "Auto-created", "Needs definition", "Errors"
- ✅ Progress indicator shows "8 of 12 values defined"
- ✅ One-click entity creation from unmapped values UI
- ✅ Import approval button enabled only after all definitions complete
- ✅ Users don't need to re-upload CSV to fix missing catalog values

### Technical Requirements
- ✅ Staging tables accept NULL foreign keys temporarily
- ✅ Validation logic separates errors from warnings
- ✅ Job summary tracks `needs_definition` separate from `errors`
- ✅ Value mapping system handles post-validation entity creation
- ✅ Commit phase applies value mappings to staged rows

---

## Questions & Edge Cases

### Q1: What if user defines a size but doesn't select the correct category?
**A:** Size creation modal should:
1. Pre-fill category from CSV row context if available
2. Show category field prominently
3. Validate category selection before save
4. Link size to correct category in `brand_sizes` table

### Q2: What if user creates material but forgets to add certification?
**A:** Material sheet should:
1. Mark certification as optional initially
2. Show warning if eco-claimed material lacks certification
3. Allow saving without certification (basic material)
4. Support editing material to add certification later

### Q3: Can user skip defining some values and proceed anyway?
**A:** No. Import approval requires ALL unmapped values to be defined. However:
- Auto-created entities (colors) don't require user action
- Users can delete rows with problematic values if they don't want to define them

### Q4: How to handle large imports with hundreds of missing values?
**A:** Future enhancement:
1. Batch creation UI (create 10 sizes at once)
2. CSV template export of missing values for bulk definition
3. Smart defaults (e.g., standard size charts for common categories)
4. Import from existing brand's catalog

---

## Related Files & References

### Key Files
- `packages/jobs/src/trigger/validate-and-stage.ts` - Validation logic
- `apps/app/src/components/import/unmapped-values-section.tsx` - UI for defining values
- `apps/app/src/components/import/import-review-content.tsx` - Import review screen
- `apps/api/src/trpc/routers/bulk/values.ts` - Value definition API
- `packages/db/src/schema/data/staging-*.ts` - Staging tables schema

### Documentation
- `BULK_API_RESTRUCTURE.md` - API design
- `.docs/bulk-import-trigger-fix.md` - Trigger job debugging
- `apps/api/public/templates/README.md` - CSV template docs
- `claude.md` - Project-wide standards

### Related Components (Manual Import Reference)
- `apps/app/src/components/passports/form/blocks/materials-block.tsx`
- `apps/app/src/components/passports/form/blocks/organization-block.tsx`
- `apps/app/src/components/sheets/material-sheet.tsx`
- `apps/app/src/components/modals/size-modal.tsx`
- `apps/app/src/components/select/color-select.tsx`

---

## Timeline Estimate

### Phase 1: Core Validation (2-3 hours)
- Update validation logic to separate errors/warnings
- Modify staging inserts to allow NULL foreign keys
- Test validation with sample CSV

### Phase 2: UI Updates (2-3 hours)
- Enhance unmapped values section visual grouping
- Update status badges and progress indicators
- Connect entity creation sheets to bulk import flow

### Phase 3: Testing & Polish (1-2 hours)
- End-to-end testing with real CSV files
- Edge case handling (large imports, all missing values, etc.)
- Documentation updates

**Total: 5-8 hours**

---

## Next Steps

1. **Review & Approval:** Get stakeholder sign-off on new classification system
2. **Database Migration:** Create and test staging table NULL constraints
3. **Implementation:** Follow phase-by-phase plan
4. **Testing:** Run comprehensive test suite with edge cases
5. **Documentation:** Update all related docs and create user guide
6. **Deployment:** Stage → Production with monitoring

---

*Document created: 2025-11-10*  
*Last updated: 2025-11-10*  
*Status: Awaiting implementation*
