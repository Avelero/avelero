# Error Export Fix Plan

## Progress Tracking

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Staging Row Status | ✅ Complete | Schema already has `rowStatus` and `errors` columns |
| Phase 2: validate-and-stage.ts | ✅ Complete | Added BLOCKED/PENDING_WITH_WARNINGS states, all products staged |
| Phase 3: commit-to-production.ts | ✅ Complete | Queries for PENDING + PENDING_WITH_WARNINGS, removed error report trigger |
| Phase 4: generate-error-report.ts | ✅ Complete | Updated query to find BLOCKED and PENDING_WITH_WARNINGS |
| Phase 5: Excel Parser Validation | ⏳ Partial | Some validation added inline in validate-and-stage |

## Overview

This document outlines the fixes required to properly implement error detection, staging, and error report generation for the bulk import workflow.

## Current Issues

1. ~~**Validation errors don't create staging rows**~~ ✅ FIXED - All products now staged regardless of errors
2. ~~**Error report triggers in wrong place**~~ ✅ FIXED - Now triggers in `validate-and-stage`
3. ~~**No distinction between blocking vs non-blocking errors**~~ ✅ FIXED - BLOCKED vs PENDING_WITH_WARNINGS
4. ~~**Errors not persisted**~~ ✅ FIXED - Errors saved to `staging_products.errors` JSONB

---

## Template Specifications

### Basic Import Template
```
Product Title | Product Handle | Manufacturer | Description | Image | Status | Category | Season | Tags | Barcode | SKU | Attribute 1 | Attribute Value 1 | Attribute 2 | Attribute Value 2 | Attribute 3 | Attribute Value 3 | kgCO2e Carbon Footprint | Liters Water Used | Eco-claims | Grams Weight | Materials | Percentages | Raw Material | Weaving | Dyeing / Printing | Stitching | Assembly | Finishing
```

### Export Template (includes UPID)
```
Product Title | Product Handle | Manufacturer | Description | Image | Status | Category | Season | Tags | UPID | Barcode | SKU | Attribute 1 | Attribute Value 1 | Attribute 2 | Attribute Value 2 | Attribute 3 | Attribute Value 3 | kgCO2e Carbon Footprint | Liters Water Used | Eco-claims | Grams Weight | Materials | Percentages | Raw Material | Weaving | Dyeing / Printing | Stitching | Assembly | Finishing
```

---

## Staging Row States

| State | Meaning | Commits to Production? |
|-------|---------|------------------------|
| `PENDING` | No errors, ready for commit | ✅ Yes |
| `PENDING_WITH_WARNINGS` | Has field errors but product will still be created (bad fields skipped) | ✅ Yes |
| `BLOCKED` | Missing required data (Product Title), cannot create product | ❌ No |
| `COMMITTED` | Successfully committed to production | N/A (final state) |

---

## Column-by-Column Validation Rules

### Delimiter Policy
**Semicolon (`;`) is the ONLY delimiter.** Any other character (pipe, comma, etc.) will be treated as part of the value, not as a separator. This prevents confusion about which characters are allowed in entity names.

---

### Required Fields

| Column | Required? | Validation | On Error |
|--------|-----------|------------|----------|
| **Product Title** | **YES** (parent rows only) | Non-empty string when Product Handle is present | `BLOCKED` - Cannot create product |
| **Product Handle** | YES (parent rows) | Non-empty string for parent rows; empty = child row (inherits from previous parent) | Empty = child row behavior |

---

### Optional Fields - Auto-Create Entities

| Column | Validation | On Error |
|--------|------------|----------|
| **Manufacturer** | Any non-empty string | Auto-create if not exists |
| **Season** | Any non-empty string | Auto-create if not exists |
| **Tags** | Semicolon-delimited: `tag1;tag2;tag3` | Auto-create each tag if not exists |
| **Eco-claims** | Semicolon-delimited: `claim1;claim2` | Auto-create each claim if not exists |
| **Materials** | Semicolon-delimited: `material1;material2` | Auto-create each material if not exists |
| **Raw Material** | Facility name | Auto-create if not exists |
| **Weaving** | Facility name | Auto-create if not exists |
| **Dyeing / Printing** | Facility name | Auto-create if not exists |
| **Stitching** | Facility name | Auto-create if not exists |
| **Assembly** | Facility name | Auto-create if not exists |
| **Finishing** | Facility name | Auto-create if not exists |

---

### Optional Fields - Validation Required

| Column | Validation | On Error |
|--------|------------|----------|
| **Description** | Any string | Never fails |
| **Image** | Valid URL or storage path | `PENDING_WITH_WARNINGS` - Skip field, log error |
| **Status** | Must be one of: `unpublished`, `published`, `archived`, `scheduled` (case-insensitive) | `PENDING_WITH_WARNINGS` - Default to `unpublished`, log error |
| **Category** | Format: `Parent > Child > Grandchild` (space-arrow-space delimiter). **Category MUST exist** (no auto-create) | `PENDING_WITH_WARNINGS` - Skip field, log error |
| **Barcode** | Any string | Never fails |
| **SKU** | Any string | Never fails |
| **kgCO2e Carbon Footprint** | Numeric value (decimal allowed) | `PENDING_WITH_WARNINGS` - Skip field if not numeric |
| **Liters Water Used** | Numeric value (decimal allowed) | `PENDING_WITH_WARNINGS` - Skip field if not numeric |
| **Grams Weight** | Numeric value (decimal allowed) | `PENDING_WITH_WARNINGS` - Skip field if not numeric |
| **Percentages** | Semicolon-delimited: `80;20` - must match Materials count, each must be numeric | `PENDING_WITH_WARNINGS` - Skip if count mismatch or not numeric |

---

### UPID Handling (Export Template Only)

| Scenario | Action |
|----------|--------|
| Empty cell | Create new variant, generate UPID during commit |
| UPID exists in database | Match to existing variant (ENRICH mode) |
| UPID does not exist in database | `PENDING_WITH_WARNINGS` - Error, skip variant creation |
| Duplicate UPID in same Excel sheet | `PENDING_WITH_WARNINGS` - Second occurrence is error, first is processed |

---

### Attribute Handling

**Rules:**
1. Attributes come in pairs: `Attribute N` + `Attribute Value N`
2. **Both must be present** for assignment - if either is missing, skip the pair and log warning
3. Attribute values must match their parent attribute - a value is only a match if it belongs to the same attribute
4. If attribute is new (auto-created), all its values are also new by definition

| Scenario | Action |
|----------|--------|
| Both Attribute and Value provided | Auto-create attribute/value if needed, create assignment |
| Only Attribute provided (no value) | `PENDING_WITH_WARNINGS` - Skip this pair, log error |
| Only Value provided (no attribute) | `PENDING_WITH_WARNINGS` - Skip this pair, log error |
| Value exists but under different attribute | No match - treat as new value for specified attribute |

---

## Implementation Changes

### Phase 1: Update Staging Row Status

**File:** `packages/db/src/schema/staging.ts`

Add/update the `rowStatus` enum to include:
- `PENDING`
- `PENDING_WITH_WARNINGS`
- `BLOCKED`
- `COMMITTED`

### Phase 2: Update validate-and-stage.ts

**File:** `packages/jobs/src/trigger/bulk/validate-and-stage.ts`

1. **Separate validation into blocking vs non-blocking errors**
   - Blocking: Missing Product Title on parent row
   - Non-blocking: All other field errors

2. **Stage ALL products regardless of errors**
   - `PENDING` - No errors
   - `PENDING_WITH_WARNINGS` - Has non-blocking errors
   - `BLOCKED` - Has blocking errors (missing Product Title)

3. **Store errors in staging table**
   - Add `errors` JSONB column to staging_products if not exists
   - Persist field-level errors: `[{field: "Category", message: "Not found"}]`

4. **Move error report trigger here**
   - Trigger `generate-error-report` if ANY products have `BLOCKED` or `PENDING_WITH_WARNINGS` status
   - Set `hasExportableFailures = true` on import job

5. **Add comprehensive logging**
   ```
   Summary:
   - Total products: X
   - PENDING: X (ready for commit)
   - PENDING_WITH_WARNINGS: X (will commit with field skips)
   - BLOCKED: X (will not commit)
   - Error report triggered: true/false
   ```

### Phase 3: Update commit-to-production.ts

**File:** `packages/jobs/src/trigger/bulk/commit-to-production.ts`

1. **Query staging rows with status `PENDING` or `PENDING_WITH_WARNINGS`**
   - Skip `BLOCKED` rows entirely

2. **For `PENDING_WITH_WARNINGS` products:**
   - Check the `errors` array
   - Skip fields that have errors (don't write bad data)
   - Still create/update the product

3. **Remove error report trigger**
   - Error report is now triggered in validate-and-stage

4. **Add comprehensive logging**
   ```
   Summary:
   - Products created: X
   - Products updated: X
   - Products skipped (BLOCKED): X
   - Fields skipped due to errors: X
   ```

### Phase 4: Update generate-error-report.ts

**File:** `packages/jobs/src/trigger/bulk/generate-error-report.ts`

1. **Update query to find products with errors**
   ```sql
   WHERE jobId = ? 
   AND (rowStatus = 'BLOCKED' OR rowStatus = 'PENDING_WITH_WARNINGS')
   ```

2. **Include all rows with errors in the report**
   - Both blocked products and products with field warnings

### Phase 5: Update Excel Parser Validation

**File:** `packages/jobs/src/lib/excel-parser.ts`

1. **UPID validation**
   - Track seen UPIDs for duplicate detection within file
   - Validate UPID exists in database (for ENRICH mode)

2. **Attribute pair validation**
   - Ensure both Attribute N and Attribute Value N are present
   - Skip incomplete pairs with warning

3. **Numeric field validation**
   - kgCO2e, Liters Water, Grams Weight, Percentages
   - Return warning if not numeric

4. **Delimiter enforcement**
   - Only split on semicolon for: Tags, Eco-claims, Materials, Percentages

---

## Testing Checklist

- [ ] Product with missing title → BLOCKED, no commit
- [ ] Product with invalid category → PENDING_WITH_WARNINGS, commits without category
- [ ] Product with invalid status → PENDING_WITH_WARNINGS, defaults to unpublished
- [ ] UPID not found in database → PENDING_WITH_WARNINGS, variant skipped
- [ ] Duplicate UPID in file → First processed, second errors
- [ ] Incomplete attribute pair → PENDING_WITH_WARNINGS, pair skipped
- [ ] Non-numeric carbon value → PENDING_WITH_WARNINGS, field skipped
- [ ] Error report contains all products with any errors
- [ ] Error report highlights correct fields in red

---

## Logging Requirements

Both `validate-and-stage` and `commit-to-production` should log a final summary:

### validate-and-stage Summary
```
Validate-and-stage completed:
- Total products parsed: 1000
- PENDING (no errors): 950
- PENDING_WITH_WARNINGS (field errors): 45
- BLOCKED (cannot create): 5
- Total field errors logged: 52
- Error report triggered: true
- Proceeding to commit: 995 products
```

### commit-to-production Summary
```
Commit-to-production completed:
- Products processed: 995
- Products created: 800
- Products updated: 195
- Products skipped (BLOCKED): 5
- Variants created: 2500
- Variants updated: 300
- Fields skipped due to errors: 52
```
