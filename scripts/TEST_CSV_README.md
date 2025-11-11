# Bulk Import Test CSV Files

This directory contains comprehensive test CSV files for validating the bulk import system. Each file tests different validation scenarios and edge cases.

## Test Files Overview

### 01. test-01-valid-data.csv (2.2 MB)
**Purpose:** Baseline test with all valid, mapped values
**Rows:** 10,000
**Expected Result:** All rows should pass validation
**Tests:**
- Valid colors: Black, White, Navy, Gray, Beige
- Valid sizes: XS, S, M, L, XL
- Valid categories: Tops, Bottoms, Outerwear, Dresses
- All required fields populated correctly

**Use Case:** Test that the import system handles clean, valid data correctly

---

### 02. test-02-duplicates.csv (2.2 MB)
**Purpose:** Test duplicate UPID detection
**Rows:** 10,000 (with ~100 duplicates)
**Expected Result:** ~100 rows should fail with "DUPLICATE_VALUE" error
**Tests:**
- Duplicate UPIDs (1% of rows)
- Every 100th row reuses a UPID from 50 rows earlier
- Unique SKUs for all rows

**Use Case:** Verify duplicate detection works correctly and error messages are clear

---

### 03. test-03-unmapped-values.csv (2.2 MB)
**Purpose:** Test unmapped value detection and user definition workflow
**Rows:** 10,000
**Expected Result:** All rows valid, but requires user to define unmapped values
**Tests:**
- Unmapped colors: Coral, Burgundy, Orange, Pink, Navy Blue, Light Gray, etc.
- Unmapped sizes: 2XL, 3XL, XXS, One Size
- Unmapped categories: Accessories, Footwear, T-Shirts, Activewear, etc.

**Use Case:** Test the "Define Values" workflow where users create new catalog entities

**Expected Unmapped Values:**
- ~12 different colors
- ~4 different sizes
- ~8 different categories

---

### 04. test-04-missing-required.csv (2.1 MB)
**Purpose:** Test missing required field validation
**Rows:** 10,000 (~2,000 with errors)
**Expected Result:** ~2,000 rows should fail validation
**Tests:**
- Missing product_name (every 15th row)
- Missing both UPID and SKU (every 15th row, offset by 5)
- Missing UPID only (every 15th row, offset by 10)

**Error Types:**
- "REQUIRED_FIELD_EMPTY" for product_name
- "REQUIRED_FIELD_EMPTY" for upid/sku

**Use Case:** Verify required field validation catches all missing data

---

### 05. test-05-field-length-violations.csv (3.4 MB)
**Purpose:** Test field length limit validation
**Rows:** 10,000 (~1,000 with violations)
**Expected Result:** ~1,000 rows should fail validation
**Tests:**
- Product names > 100 characters (every 20th row)
- Descriptions > 2,000 characters (every 20th row, offset by 10)

**Error Types:**
- "FIELD_TOO_LONG" for product_name (150 chars)
- "FIELD_TOO_LONG" for description (2,500 chars)

**Use Case:** Verify field length constraints are enforced

---

### 06. test-06-wrong-headers.csv (2.2 MB)
**Purpose:** Test header validation and normalization
**Rows:** 10,000
**Expected Result:** Should fail at parsing stage or map headers correctly
**Tests:**
- Wrong header names (ProductName instead of product_name)
- Case mismatches (UPID instead of upid)
- Format differences (ColorName instead of color_name)

**Wrong Headers Used:**
```
ProductName, UPID, SKU, Description, Category, Season,
PrimaryImage, ColorName, SizeName, ProductImage,
Material1, Material1Pct, Material2, Material2Pct,
Material3, Material3Pct, CareCodes, EcoClaims, EnvScore
```

**Use Case:** Test header normalization or verify clear error messages for wrong headers

---

### 07. test-07-mixed-errors.csv (2.5 MB)
**Purpose:** Test multiple error types in a realistic scenario
**Rows:** 10,000
**Expected Result:** Various validation errors distributed across file
**Tests:**
- 50% valid mapped values, 50% unmapped values
- ~5% duplicate UPIDs
- ~5% missing required fields
- ~2% field length violations

**Use Case:** Test the system handles multiple error types gracefully in a single import

---

### 08. test-08-minimal-required.csv (758 KB)
**Purpose:** Test minimum viable data import
**Rows:** 10,000
**Expected Result:** All rows should pass validation
**Tests:**
- Only required fields populated:
  - product_name
  - upid
  - sku
  - material_1_name
  - material_1_percentage
- All optional fields empty

**Use Case:** Verify system works with bare minimum data

---

### 09. test-09-empty.csv (267 bytes)
**Purpose:** Test empty file handling
**Rows:** 0 (headers only)
**Expected Result:** Should fail with appropriate error message
**Tests:**
- Valid headers
- No data rows

**Use Case:** Verify graceful handling of empty imports

---

### 10. test-10-large-mixed.csv (2.2 MB)
**Purpose:** Realistic production-like test with mixed data
**Rows:** 10,000
**Expected Result:** ~7,000 rows require value definitions, ~3,000 pass validation
**Tests:**
- 70% unmapped values (realistic for new brand onboarding)
- 30% valid mapped values
- Random distribution of optional fields

**Use Case:** Stress test and performance test with realistic data distribution

---

## How to Use These Test Files

### Testing Workflow

1. **Start with valid data:**
   ```bash
   # Upload test-01-valid-data.csv
   # Expected: All rows pass, ready for approval
   ```

2. **Test unmapped values workflow:**
   ```bash
   # Upload test-03-unmapped-values.csv
   # Expected: All rows valid, but requires defining ~24 new values
   # Define colors, sizes, and categories through UI
   # Approve import
   ```

3. **Test error detection:**
   ```bash
   # Upload test-02-duplicates.csv
   # Expected: ~100 duplicate errors shown in Errors tab
   # Export failed rows CSV
   ```

4. **Test mixed scenarios:**
   ```bash
   # Upload test-07-mixed-errors.csv
   # Expected: Mix of errors and warnings
   # Some rows in Errors tab, some needing value definitions
   ```

5. **Stress test:**
   ```bash
   # Upload test-10-large-mixed.csv
   # Expected: System handles 10k rows efficiently
   # Real-time progress updates during validation
   ```

### Regenerating Test Files

To regenerate all test files with different data:

```bash
cd scripts
python3 generate_test_csvs.py
```

The generator uses randomization, so each run produces different data while maintaining the same error patterns.

### Customizing Test Files

Edit `generate_test_csvs.py` to:
- Change `NUM_ROWS` to adjust file size
- Modify error percentages (duplicates, missing fields, etc.)
- Add new test scenarios
- Customize data pools (colors, sizes, materials, etc.)

---

## Expected Catalog Values

For tests to work correctly, your database should have these catalog values:

### Valid Colors (should exist):
- Black
- White
- Navy
- Gray
- Beige

### Valid Sizes (should exist):
- XS
- S
- M
- L
- XL

### Valid Categories (should exist):
- Tops
- Bottoms
- Outerwear
- Dresses

### Unmapped Values (should NOT exist initially):
- Colors: Coral, Burgundy, Orange, Pink, Navy Blue, Light Gray, Olive Green, Mustard, Teal, Lavender, Crimson, Charcoal
- Sizes: 2XL, 3XL, XXS, One Size
- Categories: Accessories, Footwear, T-Shirts, Shirts, Activewear, Loungewear, Swimwear, Underwear

---

## Testing Checklist

- [ ] Test 01: Valid data imports successfully
- [ ] Test 02: Duplicates are detected and shown in Errors tab
- [ ] Test 03: Unmapped values are shown in Unmapped tab with correct counts
- [ ] Test 03: Can define new colors, sizes, categories from review dialog
- [ ] Test 04: Missing required fields show appropriate error messages
- [ ] Test 05: Field length violations are caught
- [ ] Test 06: Wrong headers are handled (either normalized or error shown)
- [ ] Test 07: Mixed errors are handled gracefully
- [ ] Test 08: Minimal data imports successfully
- [ ] Test 09: Empty file shows appropriate error
- [ ] Test 10: Large mixed file processes efficiently
- [ ] Real-time progress updates work during validation
- [ ] Export failed rows CSV works correctly
- [ ] Can approve and commit after defining unmapped values
- [ ] System handles concurrent imports (if applicable)

---

## Performance Benchmarks

Expected processing times for 10,000 rows:

- **Validation phase:** 30-60 seconds
- **Database inserts:** 5-10 seconds
- **Total time:** < 2 minutes

Monitor these metrics:
- Memory usage (should stay under 500MB)
- Database connections (check for leaks)
- WebSocket updates (should be smooth)
- UI responsiveness (no freezing)

---

## Troubleshooting

### All values showing as "already in catalog"
- Delete the old import job from database
- Upload test-03-unmapped-values.csv (fresh import)
- Verify unmapped colors/sizes/categories don't exist in your catalog

### Duplicates not detected
- Check that UPID is the primary matching field
- Verify validation logic in validate-and-stage job

### Performance issues with 10k rows
- Check batch size (should be 100)
- Verify database indexes on staging tables
- Monitor connection pool usage

---

## Notes

- Each CSV is ~2-3 MB (except minimal and empty)
- Files use UTF-8 encoding
- Line endings are Unix-style (LF)
- All UPIDs follow format: `UPID-NNNNNN`
- All SKUs follow format: `SKU-XXX-NNNNN`
- Data is randomly generated on each run
- Generator script is idempotent (safe to run multiple times)
