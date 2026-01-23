# Barcode Coverage Implementation Plan

## Overview

This document outlines the phased implementation plan for the barcode coverage tracking feature. The feature ensures brand-level barcode uniqueness, validates GS1 GTIN format, provides real-time uniqueness checking in the UI, and displays barcode completion status in the passports table.

**Reference Document**: [barcode-coverage-specs.md](./barcode-coverage-specs.md)

---

## Pre-Implementation Requirements

Before starting implementation:

1. **Clean Git State**: Ensure all current changes are committed
2. **Branch Creation**: Create feature branch `feature/barcode-coverage`
3. **Database Backup**: Ensure development database is backed up (for migration testing)
4. **Check for Existing Duplicates**: Run the duplicate detection query on the database

```sql
SELECT pv.barcode, p.brand_id, COUNT(*) as count
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
WHERE pv.barcode IS NOT NULL AND pv.barcode != ''
GROUP BY pv.barcode, p.brand_id
HAVING COUNT(*) > 1;
```

---

## Phase 1: Database Foundation

**Goal**: Establish the database-level barcode uniqueness constraint and query functions.

### Tasks

#### 1.1 Add Barcode Uniqueness Query Function

**File**: `packages/db/src/queries/products/variants.ts`

Add the `isBarcodeTakenInBrand()` function that checks if a barcode is already used within a brand.

```typescript
export async function isBarcodeTakenInBrand(
  db: Database,
  brandId: string,
  barcode: string,
  excludeVariantId?: string,
): Promise<boolean>
```

**Pattern Reference**: Follow `isSlugTaken()` in `packages/db/src/queries/brand/brands.ts`

**Acceptance Criteria**:
- [ ] Function returns `true` when barcode exists in brand
- [ ] Function returns `false` when barcode doesn't exist
- [ ] `excludeVariantId` correctly excludes the specified variant
- [ ] Empty string barcode always returns `false`

#### 1.2 Add Batch Barcode Check Function

**File**: `packages/db/src/queries/products/variants.ts`

Add a batch function for checking multiple barcodes (used during sync/import).

```typescript
export async function getBatchTakenBarcodes(
  db: Database,
  brandId: string,
  barcodes: string[],
  excludeVariantIds?: string[],
): Promise<string[]>
```

**Acceptance Criteria**:
- [ ] Returns array of barcodes that are already taken
- [ ] Handles empty input gracefully
- [ ] Performs single query for efficiency

#### 1.3 Write Unit Tests for Database Functions

**File**: `packages/db/__tests__/unit/queries/barcode-uniqueness.test.ts`

Create comprehensive unit tests for the new query functions.

**Test Cases**:
- [ ] `isBarcodeTakenInBrand` returns true for existing barcode
- [ ] `isBarcodeTakenInBrand` returns false for non-existent barcode
- [ ] `isBarcodeTakenInBrand` with `excludeVariantId` excludes self
- [ ] `isBarcodeTakenInBrand` returns false for empty string
- [ ] `isBarcodeTakenInBrand` returns false for barcode in different brand
- [ ] `getBatchTakenBarcodes` returns correct taken barcodes
- [ ] `getBatchTakenBarcodes` handles empty input

#### 1.4 Add Database Schema Unique Constraint

**File**: `packages/db/src/schema/products/product-variants.ts`

Add the unique index constraint on barcode scoped to brand.

```typescript
uniqueIndex("idx_unique_barcode_per_brand")
  .on(table.barcode, sql`get_product_brand_id(product_id)`)
  .where(sql`barcode IS NOT NULL AND barcode != ''`),
```

**Pattern Reference**: Follow `idx_unique_upid_per_brand` constraint in the same file.

**Steps**:
1. Add the index definition to the schema
2. Run `bun db:generate` to generate migration
3. Review generated migration SQL
4. Run `bun db:migrate` to apply
5. Run `bun types:generate` from `packages/supabase`

**Acceptance Criteria**:
- [ ] Migration generated successfully
- [ ] Migration applies without errors
- [ ] Constraint prevents duplicate barcodes within same brand
- [ ] Constraint allows same barcode in different brands
- [ ] Constraint allows multiple null/empty barcodes

#### 1.5 Write Integration Tests for Constraint

**File**: `packages/db/__tests__/integration/queries/barcode-constraint.test.ts`

Test the database constraint directly.

**Test Cases**:
- [ ] Prevents duplicate barcode in same brand at DB level
- [ ] Allows same barcode in different brands at DB level
- [ ] Allows multiple null barcodes in same brand
- [ ] Allows multiple empty string barcodes in same brand

---

## Phase 2: API Layer Validation

**Goal**: Add barcode format validation and uniqueness checking to the API layer.

### Tasks

#### 2.1 Add Barcode Schema Validation

**File**: `apps/api/src/schemas/_shared/primitives.ts`

Add the GS1 GTIN barcode validation schema and normalization function.

```typescript
export const barcodeSchema = z
  .string()
  .regex(
    /^(\d{8}|\d{12}|\d{13}|\d{14})$/,
    "Barcode must be exactly 8, 12, 13, or 14 digits"
  )
  .optional();

export function normalizeBarcode(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed;
}

/**
 * Normalizes a barcode to GTIN-14 format for GS1 Digital Link compatibility.
 * Pads shorter GTINs with leading zeros.
 *
 * NOTE: We store the original format in the database but normalize for lookups.
 * The DPP resolution layer already handles this - see apps/dpp/src/lib/validation.ts
 */
export function normalizeToGtin14(barcode: string): string {
  return barcode.padStart(14, "0");
}
```

**Important**: GS1 recommends storing barcodes padded to 14 characters with leading zeros. However, the current system already handles normalization at the resolution layer (see `apps/dpp/src/lib/validation.ts:68-70` and `apps/api/src/trpc/routers/dpp-public/index.ts:291`). For consistency, we should store barcodes in their normalized GTIN-14 format.

**Acceptance Criteria**:
- [ ] Schema accepts 8, 12, 13, 14 digit numeric strings
- [ ] Schema rejects other lengths
- [ ] Schema rejects non-numeric strings
- [ ] `normalizeBarcode` trims whitespace
- [ ] `normalizeBarcode` returns undefined for empty/null
- [ ] `normalizeToGtin14` pads with leading zeros

#### 2.2 Write Unit Tests for Barcode Schema

**File**: `apps/api/__tests__/unit/schemas/barcode.test.ts`

**Test Cases** (from specs section 9.1):
- [ ] Accepts 8-digit GTIN-8
- [ ] Accepts 12-digit GTIN-12/UPC
- [ ] Accepts 13-digit GTIN-13/EAN
- [ ] Accepts 14-digit GTIN-14
- [ ] Accepts undefined (optional)
- [ ] Rejects 7, 9, 10, 11, 15 digit strings
- [ ] Rejects alphanumeric strings
- [ ] Rejects strings with dashes/spaces
- [ ] `normalizeBarcode` tests for trimming and empty handling

#### 2.3 Add checkBarcode Endpoint

**File**: `apps/api/src/trpc/routers/products/variants.ts`

Add the real-time barcode availability check endpoint.

```typescript
checkBarcode: brandRequiredProcedure
  .input(z.object({
    barcode: z.string().min(1),
    excludeVariantId: z.string().uuid().optional()
  }))
  .query(async ({ ctx, input }) => {
    const { db, brandId } = ctx;
    const taken = await isBarcodeTakenInBrand(db, brandId, input.barcode, input.excludeVariantId);
    return { available: !taken };
  })
```

**Pattern Reference**: Follow `brand.checkSlug` in `apps/api/src/trpc/routers/brand/base.ts`

**Acceptance Criteria**:
- [ ] Returns `{ available: true }` for unused barcode
- [ ] Returns `{ available: false }` for taken barcode
- [ ] Correctly handles `excludeVariantId` for updates
- [ ] Scoped to brand from context

#### 2.4 Update Variant Mutation Schemas

**File**: `apps/api/src/trpc/routers/products/variants.ts`

Update the existing input schemas to use barcode validation:

- [ ] `createVariantInputSchema` - add `barcodeSchema`
- [ ] `updateVariantInputSchema` - add `barcodeSchema`
- [ ] `syncVariantInputSchema` - add `barcodeSchema`

#### 2.5 Add Barcode Validation to Mutations

**File**: `apps/api/src/trpc/routers/products/variants.ts`

Add uniqueness checks before insert/update:

**Create mutation**:
```typescript
if (input.barcode) {
  const barcodeTaken = await isBarcodeTakenInBrand(ctx.db, brandId, input.barcode);
  if (barcodeTaken) {
    throw badRequest("This barcode is already used by another variant in your brand");
  }
}
```

**Update mutation**:
```typescript
if (input.barcode !== undefined && input.barcode !== null) {
  const barcodeTaken = await isBarcodeTakenInBrand(
    ctx.db, brandId, input.barcode, variantId
  );
  if (barcodeTaken) {
    throw badRequest("This barcode is already used by another variant in your brand");
  }
}
```

**Sync mutation**:
- Check for duplicates within the batch
- Check batch against existing database barcodes

**Acceptance Criteria**:
- [ ] Create mutation rejects duplicate barcodes
- [ ] Update mutation allows keeping own barcode
- [ ] Update mutation rejects taking another variant's barcode
- [ ] Sync mutation rejects duplicates within batch
- [ ] Sync mutation rejects barcodes already in database
- [ ] Clear error messages returned

#### 2.6 Handle Database Constraint Violations

Add error handling for race conditions where the API check passes but the database constraint fails:

```typescript
try {
  await db.insert(productVariants).values({ ... });
} catch (error) {
  if (isUniqueConstraintViolation(error, 'idx_unique_barcode_per_brand')) {
    throw badRequest("This barcode was just claimed by another operation. Please try a different barcode.");
  }
  throw error;
}
```

**Acceptance Criteria**:
- [ ] Race condition produces user-friendly error
- [ ] Other errors are re-thrown

#### 2.7 Write Integration Tests for API Endpoints

**File**: `apps/api/__tests__/integration/trpc/barcode-validation.test.ts`

**Test Cases** (from specs sections 9.3-9.6):

**checkBarcode endpoint**:
- [ ] Returns available: true for unused barcode
- [ ] Returns available: false for existing barcode
- [ ] Returns available: true when excluding own variant
- [ ] Returns available: true for barcode in different brand
- [ ] Requires non-empty barcode
- [ ] Validates excludeVariantId UUID format

**Create mutation**:
- [ ] Creates variant with valid unique barcode
- [ ] Rejects duplicate barcode in same brand
- [ ] Allows variant creation without barcode
- [ ] Rejects invalid barcode format
- [ ] Allows same barcode in different brand

**Update mutation**:
- [ ] Updates variant with new unique barcode
- [ ] Allows keeping same barcode
- [ ] Rejects changing to another variant's barcode
- [ ] Allows clearing barcode

**Sync mutation**:
- [ ] Creates new variants with unique barcodes
- [ ] Rejects sync with duplicate barcodes in batch
- [ ] Rejects sync with barcode matching existing variant
- [ ] Allows sync with mix of barcodes and no-barcodes

---

## Phase 3: GTIN-14 Normalization

**Goal**: Store barcodes in normalized GTIN-14 format (padded to 14 digits with leading zeros) for GS1 Digital Link compatibility.

### Context

GS1 recommends that all GTINs be stored in 14-digit format for consistency. The DPP resolution layer already normalizes barcodes for lookup (see `apps/dpp/src/lib/validation.ts`). To simplify the system and ensure consistency:

1. User enters barcode in any valid format (8, 12, 13, 14 digits)
2. System validates format and normalizes to GTIN-14 before storage
3. Display shows the original format (or we can show the normalized format)
4. Lookup uses normalized format

### Tasks

#### 3.1 Update Barcode Storage to GTIN-14

**Files to modify**:
- `apps/api/src/trpc/routers/products/variants.ts` - Normalize before insert/update
- `packages/db/src/queries/products/passports.ts` - Normalize when copying to passport

Add normalization before storage:
```typescript
const normalizedBarcode = input.barcode ? normalizeToGtin14(input.barcode) : null;
```

**Acceptance Criteria**:
- [ ] 8-digit barcode stored as 14 digits with 6 leading zeros
- [ ] 12-digit barcode stored as 14 digits with 2 leading zeros
- [ ] 13-digit barcode stored as 14 digits with 1 leading zero
- [ ] 14-digit barcode stored as-is
- [ ] Null/empty barcode stored as null

#### 3.2 Update Uniqueness Check for Normalized Barcodes

Since we're normalizing on storage, the uniqueness check should also normalize:

```typescript
export async function isBarcodeTakenInBrand(
  db: Database,
  brandId: string,
  barcode: string,
  excludeVariantId?: string,
): Promise<boolean> {
  const normalizedBarcode = normalizeToGtin14(barcode);
  // ... rest of function uses normalizedBarcode
}
```

**Acceptance Criteria**:
- [ ] Entering "12345678" when "00000012345678" exists returns taken
- [ ] Normalized comparison works correctly

#### 3.3 Update Passport Barcode Sync

**File**: `packages/db/src/queries/products/passports.ts`

Ensure passport barcode field also uses normalized format:
- `createProductPassport` - already copies from variant
- `createPassportForVariant` - normalize the input
- `batchCreatePassportsForVariants` - normalize the input

**Acceptance Criteria**:
- [ ] Passport barcode matches normalized variant barcode
- [ ] GS1 Digital Link resolution works with any input format

#### 3.4 Migration for Existing Data

If there are existing barcodes in the database that aren't normalized:

1. Create a one-time migration script to normalize existing barcodes
2. Run the normalization before adding the unique constraint

```sql
-- Normalize existing barcodes to GTIN-14
UPDATE product_variants
SET barcode = LPAD(barcode, 14, '0')
WHERE barcode IS NOT NULL AND barcode != '' AND LENGTH(barcode) < 14;

-- Also update passports
UPDATE product_passports
SET barcode = LPAD(barcode, 14, '0')
WHERE barcode IS NOT NULL AND barcode != '' AND LENGTH(barcode) < 14;
```

**Acceptance Criteria**:
- [ ] All existing barcodes normalized to 14 digits
- [ ] No data loss
- [ ] Passports match their variants

---

## Phase 4: Product List Query Enhancement

**Goal**: Add barcode coverage data to the product list response.

### Tasks

#### 4.1 Add Barcode Count to Product List Query

**File**: `packages/db/src/queries/products/list.ts`

Add `variantsWithBarcode` count to the product list query.

```typescript
const variantsWithBarcodeSubquery = db
  .select({
    productId: productVariants.productId,
    count: sql<number>`COUNT(CASE WHEN barcode IS NOT NULL AND barcode != '' THEN 1 END)::int`.as('variants_with_barcode'),
  })
  .from(productVariants)
  .where(eq(productVariants.isGhost, false))
  .groupBy(productVariants.productId)
  .as('variants_with_barcode');
```

**Acceptance Criteria**:
- [ ] Returns correct count of variants with barcodes
- [ ] Excludes ghost variants from count
- [ ] Returns 0 for products with no barcoded variants
- [ ] Performs efficiently (single subquery)

#### 4.2 Update Response Types

**File**: `packages/db/src/queries/products/list.ts`

Ensure the return type includes `variantsWithBarcode: number`.

**Acceptance Criteria**:
- [ ] Type includes variantsWithBarcode field
- [ ] Field is always a number (not null)

#### 4.3 Write Tests for List Query

**Test Cases** (from specs section 9.9):
- [ ] Returns correct barcode count for products
- [ ] Returns zero for product with no barcodes
- [ ] Excludes ghost variants from barcode count

---

## Phase 5: Filter Implementation

**Goal**: Add barcode coverage filters to the passports table.

### Tasks

#### 5.1 Add Quick Filter Configuration

**File**: `apps/app/src/config/filters.ts`

Add `barcodeComplete` filter to Tier 1:

```typescript
barcodeComplete: {
  id: "barcodeComplete",
  label: "Barcode complete",
  tier: 1,
  category: "metadata",
  inputType: "multi-select",
  operators: [...OPERATORS.multiSelect] as FilterOperator[],
  options: [
    { value: "complete", label: "Complete" },
    { value: "incomplete", label: "Incomplete" },
    { value: "none", label: "No barcodes" },
  ],
  description: "Filter by barcode completion status",
},
```

Update `FIELD_CATEGORIES.metadata.fields` to include `"barcodeComplete"`.

**Acceptance Criteria**:
- [ ] Filter appears in quick filter dropdown
- [ ] Options are correct
- [ ] Category is metadata

#### 5.2 Add Advanced Filter Configuration (Optional)

**File**: `apps/app/src/config/filters.ts`

Add `barcodeCoveragePercent` filter to Tier 2 (if needed):

```typescript
barcodeCoveragePercent: {
  id: "barcodeCoveragePercent",
  label: "Barcode coverage %",
  tier: 2,
  category: "metadata",
  inputType: "number",
  operators: [...OPERATORS.number] as FilterOperator[],
  unit: "%",
  placeholder: "0-100",
  description: "Filter by percentage of variants with barcodes",
},
```

**Acceptance Criteria**:
- [ ] Filter appears in advanced filter options
- [ ] Numeric operators available

#### 5.3 Implement Filter-to-SQL Conversion

**File**: `packages/db/src/queries/products/filter-to-sql.ts` (or equivalent)

Add handling for `barcodeComplete` filter:

```typescript
case 'barcodeComplete': {
  const values = condition.value as string[];
  const conditions: SQL[] = [];

  if (values.includes('complete')) {
    // All variants have barcodes
    conditions.push(sql`...`);
  }

  if (values.includes('incomplete')) {
    // Some but not all variants have barcodes
    conditions.push(sql`...`);
  }

  if (values.includes('none')) {
    // No variants have barcodes
    conditions.push(sql`...`);
  }

  return or(...conditions);
}
```

**Acceptance Criteria**:
- [ ] "complete" filter returns only products where all variants have barcodes
- [ ] "incomplete" filter returns products with some but not all variants having barcodes
- [ ] "none" filter returns products where no variants have barcodes
- [ ] Multiple selections work with OR logic

#### 5.4 Write Filter Integration Tests

**File**: `apps/api/__tests__/integration/trpc/barcode-filter.test.ts`

**Test Cases** (from specs section 9.8):
- [ ] Filters products with complete barcode coverage
- [ ] Filters products with incomplete barcode coverage
- [ ] Filters products with no barcodes
- [ ] Filters multiple barcode statuses

---

## Phase 6: Client-Side UI Components

**Goal**: Add barcode coverage display and real-time validation to the UI.

### Tasks

#### 6.1 Update Passports Table Types

**File**: `apps/app/src/components/tables/passports/types.ts`

Add `variantsWithBarcode` field to `PassportTableRow`:

```typescript
export interface PassportTableRow extends ProductPassportRow {
  passportIds: string[];
  variantCount: number;
  variantsWithBarcode: number; // NEW
  tags: Array<{ id: string; name: string | null; hex: string | null }>;
  firstVariantUpid?: string | null;
}
```

**Acceptance Criteria**:
- [ ] Type is updated
- [ ] No type errors in dependent code

#### 6.2 Add Barcode Coverage Column

**File**: `apps/app/src/components/tables/passports/columns.tsx`

Add the barcode coverage column with progress bar:

```typescript
{
  id: "barcodeCoverage",
  header: "Barcodes",
  cell: ({ row }) => {
    const variantsWithBarcode = row.original.variantsWithBarcode ?? 0;
    const totalVariants = row.original.variantCount ?? 0;
    const percentage = totalVariants > 0 ? (variantsWithBarcode / totalVariants) * 100 : 0;

    return (
      <div className="flex items-center gap-1.5">
        <span className="type-p text-secondary whitespace-nowrap">
          {variantsWithBarcode} / {totalVariants}
        </span>
        <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden min-w-[60px]">
          <div
            className="h-full bg-brand rounded-full transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  },
  meta: {
    headerClassName: cn("w-[140px] min-w-[140px] max-w-[140px]"),
    cellClassName: cn("w-[140px] min-w-[140px] max-w-[140px]"),
  },
}
```

**UI Specs**:
- Text: "X / Y" format with space-x-1.5
- Progress bar: 6px height (h-1.5), fully rounded, border color background, brand color fill
- Column width: 140px

**Acceptance Criteria**:
- [ ] Column displays in passports table
- [ ] Count shows correctly
- [ ] Progress bar fills proportionally
- [ ] Styling matches specs

#### 6.3 Add Real-Time Barcode Uniqueness Check

**File**: `apps/app/src/components/tables/variants/variant-row.tsx`

Add the uniqueness check with spinner following `set-slug.tsx` pattern:

1. Add local state for barcode
2. Add debounced value (500ms)
3. Add format validation
4. Add tRPC query for availability check
5. Add spinner, error indicator, tooltip

**Acceptance Criteria**:
- [ ] Spinner shows during check
- [ ] Error indicator shows for taken barcodes
- [ ] Error indicator shows for invalid format
- [ ] Tooltip explains the error
- [ ] Debouncing prevents excessive API calls
- [ ] Check only runs when format is valid

#### 6.4 Update Variant Block (if applicable)

**File**: `apps/app/src/components/forms/passport/blocks/variant-block.tsx`

Ensure the variant block passes necessary props to variant row for uniqueness checking.

**Acceptance Criteria**:
- [ ] variantId passed for excludeVariantId
- [ ] isSaved flag indicates if variant has been persisted

---

## Phase 7: Testing & Validation

**Goal**: Comprehensive testing and validation of the complete feature.

### Tasks

#### 7.1 Run All Unit Tests

```bash
bun test packages/db/__tests__/unit/queries/barcode-uniqueness.test.ts
bun test apps/api/__tests__/unit/schemas/barcode.test.ts
```

**Acceptance Criteria**:
- [ ] All unit tests pass

#### 7.2 Run All Integration Tests

```bash
bun test apps/api/__tests__/integration/trpc/barcode-validation.test.ts
bun test apps/api/__tests__/integration/trpc/barcode-filter.test.ts
bun test packages/db/__tests__/integration/queries/barcode-constraint.test.ts
```

**Acceptance Criteria**:
- [ ] All integration tests pass

#### 7.3 Manual Testing Checklist

**Barcode Input**:
- [ ] Enter valid 8-digit barcode - accepts
- [ ] Enter valid 12-digit barcode - accepts
- [ ] Enter valid 13-digit barcode - accepts
- [ ] Enter valid 14-digit barcode - accepts
- [ ] Enter 7-digit barcode - shows format error
- [ ] Enter barcode with letters - shows format error
- [ ] Enter duplicate barcode - shows "already in use" error
- [ ] Spinner shows during uniqueness check
- [ ] Error clears when corrected

**Passports Table**:
- [ ] Barcode column displays correctly
- [ ] Progress bar shows correct fill
- [ ] "0 / 0" shows for products with no variants
- [ ] Filter by "Complete" works
- [ ] Filter by "Incomplete" works
- [ ] Filter by "No barcodes" works

**GS1 Digital Link Resolution**:
- [ ] Enter 8-digit barcode, resolve via `/01/{barcode}` - works
- [ ] Enter 13-digit barcode, resolve via `/01/{barcode}` - works
- [ ] Normalized barcode resolves same passport

#### 7.4 Run Type Check

```bash
bun typecheck
```

**Acceptance Criteria**:
- [ ] No type errors

#### 7.5 Run Linter

```bash
bun lint
```

**Acceptance Criteria**:
- [ ] No lint errors

---

## Phase 8: Documentation & Cleanup

**Goal**: Final cleanup and documentation.

### Tasks

#### 8.1 Update API Documentation

If API documentation exists, update it to include:
- `products.variants.checkBarcode` endpoint
- Updated barcode validation rules
- Error messages

#### 8.2 Remove Specs Document (if desired)

The specs document can be archived or removed after implementation.

#### 8.3 Final Review

- [ ] All tests pass
- [ ] No type errors
- [ ] No lint errors
- [ ] Feature works end-to-end
- [ ] Code follows existing patterns

---

## Implementation Order Summary

| Phase | Description | Dependencies | Estimated Complexity |
|-------|-------------|--------------|---------------------|
| 1 | Database Foundation | None | Medium |
| 2 | API Layer Validation | Phase 1 | Medium |
| 3 | GTIN-14 Normalization | Phase 1, 2 | Low |
| 4 | Product List Query Enhancement | Phase 1 | Low |
| 5 | Filter Implementation | Phase 4 | Medium |
| 6 | Client-Side UI Components | Phase 2, 4, 5 | High |
| 7 | Testing & Validation | All | Medium |
| 8 | Documentation & Cleanup | Phase 7 | Low |

---

## File Change Summary

### Files to Create

| File | Phase |
|------|-------|
| `packages/db/__tests__/unit/queries/barcode-uniqueness.test.ts` | 1 |
| `apps/api/__tests__/unit/schemas/barcode.test.ts` | 2 |
| `apps/api/__tests__/integration/trpc/barcode-validation.test.ts` | 2 |
| `packages/db/__tests__/integration/queries/barcode-constraint.test.ts` | 1 |
| `apps/api/__tests__/integration/trpc/barcode-filter.test.ts` | 5 |

### Files to Modify

| File | Phase | Changes |
|------|-------|---------|
| `packages/db/src/queries/products/variants.ts` | 1 | Add `isBarcodeTakenInBrand`, `getBatchTakenBarcodes` |
| `packages/db/src/schema/products/product-variants.ts` | 1 | Add unique index constraint |
| `apps/api/src/schemas/_shared/primitives.ts` | 2 | Add `barcodeSchema`, `normalizeBarcode`, `normalizeToGtin14` |
| `apps/api/src/trpc/routers/products/variants.ts` | 2, 3 | Add `checkBarcode`, validation in mutations, normalization |
| `packages/db/src/queries/products/passports.ts` | 3 | Normalize barcode on storage |
| `packages/db/src/queries/products/list.ts` | 4 | Add `variantsWithBarcode` count |
| `apps/app/src/config/filters.ts` | 5 | Add `barcodeComplete` filter |
| `packages/db/src/queries/products/filter-to-sql.ts` | 5 | Add filter conversion |
| `apps/app/src/components/tables/passports/types.ts` | 6 | Add `variantsWithBarcode` field |
| `apps/app/src/components/tables/passports/columns.tsx` | 6 | Add barcode coverage column |
| `apps/app/src/components/tables/variants/variant-row.tsx` | 6 | Add uniqueness check spinner |

---

## Risk Mitigation

### Race Conditions

- Database constraint provides ultimate protection
- API catches constraint violations and returns friendly error

### Existing Duplicate Data

- Run duplicate detection query before migration
- Resolve duplicates before applying constraint
- Migration will fail if duplicates exist (safe)

### Performance

- Index serves both uniqueness and lookup
- Debounced client check prevents excessive API calls
- Single-query batch check for sync operations

### Rollback

If issues arise:
1. Disable client-side spinner (cosmetic only)
2. Relax API validation to warning
3. Drop constraint: `DROP INDEX idx_unique_barcode_per_brand;`

---

## Agent Progress Log

*This section is for tracking implementation progress. Each completed task should be logged here with timestamp and any notes.*

### Progress Entries

```
[YYYY-MM-DD HH:MM] Phase X.X - Task Name
- Status: Completed/In Progress/Blocked
- Notes: Any relevant observations
- Files Changed: list of files
```

---

*Plan created: 2024-XX-XX*
*Last updated: 2024-XX-XX*
