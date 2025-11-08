# Product Import Template Guide

## Overview

This CSV template is used for bulk product imports into the Avelero system. It supports both creating new products and updating existing products in a single file.

## File Format Requirements

- **Supported formats**: CSV (UTF-8 encoding), XLSX (Excel 2007+)
- **Maximum file size**: 50 MB
- **Maximum rows**: 50,000 rows
- **Header row**: Required (first row must contain column names)
- **Encoding**: UTF-8 (recommended)

## Required Columns

At minimum, your CSV must include:

1. **product_name** - Name of the product (required)
2. **upid** OR **sku** - At least one unique identifier must be provided

## Column Definitions

### Product-Level Fields

#### product_name (Required)
- **Type**: Text
- **Length**: 1-100 characters
- **Description**: Name of the product
- **Example**: "Classic Cotton T-Shirt"

#### description (Optional)
- **Type**: Text
- **Length**: 1-2000 characters
- **Description**: Detailed product description
- **Example**: "A comfortable, breathable cotton t-shirt perfect for everyday wear"

#### category_name (Optional)
- **Type**: Text
- **Description**: Category name (will be mapped to category_id)
- **Example**: "T-Shirts", "Denim", "Outerwear"
- **Note**: Category must exist in the system. Contact admin if new category needed.

#### season (Optional)
- **Type**: Text
- **Description**: Season or collection name
- **Example**: "Spring 2024", "Fall/Winter 2024", "SS25"

#### primary_image_url (Optional)
- **Type**: URL
- **Description**: URL to main product image
- **Example**: "https://cdn.example.com/products/tshirt-main.jpg"
- **Note**: Must be a valid, publicly accessible URL

### Variant-Level Fields

#### upid (Required if sku not provided)
- **Type**: Text
- **Description**: Unique Product Identifier - primary identifier for variants
- **Format**: Any unique text (recommended: UPID-{number})
- **Example**: "UPID-001234", "UPID-TSH-RED-M"
- **Note**: Used to detect if product exists (for updates vs. creates)

#### sku (Required if upid not provided)
- **Type**: Text
- **Description**: Stock Keeping Unit - alternative identifier
- **Format**: Any unique text
- **Example**: "SKU-001234", "TSH-RED-M-2024"
- **Note**: Can be used instead of UPID for matching existing products

#### color_name (Optional)
- **Type**: Text
- **Description**: Color name
- **Example**: "Red", "Navy Blue", "Mint Green"
- **Note**: New colors will be auto-created if they don't exist

#### size_name (Optional)
- **Type**: Text
- **Description**: Size name
- **Example**: "Small", "Medium", "Large", "XL", "2XL"
- **Note**: New sizes require approval with additional details (category, sort order)

#### product_image_url (Optional)
- **Type**: URL
- **Description**: URL to variant-specific image (if different from primary)
- **Example**: "https://cdn.example.com/products/tshirt-red.jpg"

### Materials (Optional)

You can specify up to 3 materials per product (extend as needed):

#### material_1_name, material_2_name, material_3_name
- **Type**: Text
- **Description**: Material name
- **Example**: "Cotton", "Polyester", "Organic Cotton", "Recycled Polyester"
- **Note**: New materials require approval with details (recyclable status, country of origin)

#### material_1_percentage, material_2_percentage, material_3_percentage
- **Type**: Number
- **Range**: 0-100
- **Description**: Percentage of material in product
- **Example**: "100", "65", "35"
- **Note**: All percentages should sum to approximately 100

### Sustainability Fields (Optional)

#### care_codes (Optional)
- **Type**: Text (comma-separated)
- **Description**: Care instruction codes
- **Example**: "MACHINE_WASH,TUMBLE_DRY,DO_NOT_BLEACH"
- **Note**: Care codes must exist in the system

#### eco_claims (Optional)
- **Type**: Text (comma-separated)
- **Description**: Environmental or sustainability claims
- **Example**: "ORGANIC,RECYCLED,CARBON_NEUTRAL"
- **Note**: New eco claims will be auto-created if they don't exist

#### environment_score (Optional)
- **Type**: Number
- **Range**: 0-100
- **Description**: Environmental impact score
- **Example**: "85"

## Create vs Update Logic

The system automatically determines whether to create or update products based on UPID/SKU:

### Creating New Products
If the UPID/SKU in your CSV **does not exist** in the database:
- A new product and variant will be created
- All provided fields will be populated

### Updating Existing Products
If the UPID/SKU in your CSV **already exists** in the database:
- The existing product and variant will be updated
- Only fields included in the CSV will be updated
- Empty/blank fields will preserve existing values (no overwrite)
- Partial updates are supported

### Example Scenarios

**Initial Import:**
```csv
product_name,upid,sku,description
"Basic T-Shirt",UPID-001,SKU-001,"A simple tee"
```
Result: Creates new product with UPID-001

**Later Update (add materials):**
```csv
product_name,upid,material_1_name,material_1_percentage
"Basic T-Shirt",UPID-001,Cotton,100
```
Result: Updates existing product UPID-001, adds material, preserves SKU and description

## Data Validation

During import, the system validates:

1. **Required fields**: product_name, upid/sku present
2. **String length limits**: Names 1-100 chars, descriptions 1-2000 chars
3. **UUID format**: Valid UUID format for ID fields (if provided)
4. **URL format**: Valid URL format for image URLs
5. **Foreign key existence**: Categories, care codes must exist
6. **Material percentages**: Should sum to ~100%
7. **Duplicates**: No duplicate UPIDs/SKUs within the file
8. **Data type validation**: Numbers where expected, text where expected

## Error Handling

### Validation Errors
If your file contains errors:
- The system will show a detailed error report
- Errors include row number, column name, and issue description
- You can export failed rows as CSV to fix and re-upload

### Common Errors

1. **Duplicate UPID**: Same UPID appears multiple times in file
   - Fix: Ensure each UPID is unique within your file

2. **Field too long**: Product name exceeds 100 characters
   - Fix: Shorten the product name

3. **Invalid UUID**: category_id format is invalid
   - Fix: Use valid UUID format or use category_name instead

4. **Category not found**: Referenced category doesn't exist
   - Fix: Contact admin to create category or use existing category

5. **Material percentages don't sum to 100**: Materials are 65% + 40% = 105%
   - Fix: Ensure percentages sum to 100

## Import Workflow

### Step 1: Pre-Upload Validation
- Client checks file format, size, required columns
- Catches obvious errors before upload

### Step 2: Server Quick Validation
- Server validates headers, detects duplicates
- Shows summary and warnings
- **Blocking errors prevent proceeding** (e.g., duplicates, missing columns)
- **Warnings are informational** (e.g., unknown columns will be ignored)

### Step 3: Phase 1 - Validation & Staging
- Background job validates all rows
- Valid data placed in staging tables
- Errors logged with row numbers
- **Real-time progress updates via WebSocket**

### Step 4: Review Staging Data
You will see:
- Summary: X valid, Y errors
- Preview of what will be created/updated
- Auto-created values (colors, eco claims)
- Complex values needing approval (materials, sizes)

### Step 5: Approve Complex Values (if needed)
For new materials, sizes, facilities:
- Fill in additional required details
- Example: Material needs recyclable status, country of origin
- Approve each value to enable import

### Step 6: Approve or Cancel
- **Approve**: Proceeds to production commit
- **Cancel**: Discards staging data, no changes to production

### Step 7: Phase 2 - Production Commit
- Background job commits staging data to production
- Creates/updates products in batches
- **Real-time progress updates via WebSocket**

### Step 8: Success
- Final summary: X created, Y updated, Z failed
- Export failed rows as CSV if needed
- Fix errors and re-upload

## Tips for Successful Imports

### Best Practices

1. **Start small**: Test with 10-100 rows first
2. **Use consistent naming**: "Red" vs "red" are treated as different values
3. **Pre-create complex entities**: Create materials/sizes manually if you need specific details
4. **Check categories exist**: Verify category names match existing categories
5. **Validate locally**: Use Excel/Sheets to check for duplicates before upload
6. **Backup data**: Export existing products before major updates
7. **Use proper encoding**: Save CSV as UTF-8 to avoid character issues

### Recommended Workflow

1. Download this template
2. Fill in a few sample rows
3. Upload and test import process
4. Review any errors or warnings
5. Adjust your data based on feedback
6. Import full dataset once confident

### Performance Expectations

| Rows | Validation Time | Commit Time | Total |
|------|----------------|-------------|-------|
| 1,000 | < 30 seconds | < 30 seconds | < 1 min |
| 5,000 | < 2 minutes | < 2 minutes | < 4 min |
| 10,000 | < 4 minutes | < 4 minutes | < 8 min |
| 50,000 | < 20 minutes | < 20 minutes | < 40 min |

*Note: Times exclude user review period*

## Example CSV

### Minimal Example (Create)
```csv
product_name,upid,sku
"Classic Cotton T-Shirt",UPID-001,SKU-TSH-001
"Slim Fit Jeans",UPID-002,SKU-JNS-001
```

### Full Example (Create with All Fields)
```csv
product_name,upid,sku,description,category_name,season,primary_image_url,color_name,size_name,product_image_url,material_1_name,material_1_percentage,material_2_name,material_2_percentage,care_codes,eco_claims,environment_score
"Organic Cotton T-Shirt",UPID-003,SKU-ORG-001,"Comfortable organic cotton tee","T-Shirts","Spring 2024","https://cdn.example.com/tshirt.jpg","Navy Blue","Medium","https://cdn.example.com/tshirt-navy.jpg","Organic Cotton",95,"Elastane",5,"MACHINE_WASH,TUMBLE_DRY","ORGANIC,GOTS_CERTIFIED",90
```

### Update Example
```csv
product_name,upid,description,material_1_name,material_1_percentage
"Classic Cotton T-Shirt",UPID-001,"Updated description with more details","Cotton",100
```

## Troubleshooting

### Issue: Import stuck in VALIDATING status
**Solution**: Check background job logs, WebSocket connection may have failed. Refresh page or use polling fallback.

### Issue: Many rows failing validation
**Solution**: Export failed rows CSV, review error messages, fix issues, re-upload fixed rows.

### Issue: Cannot proceed to Phase 1
**Solution**: Blocking errors must be fixed. Review error report, fix critical issues (duplicates, missing columns), re-upload.

### Issue: "Complex values need approval" blocking import
**Solution**: Click "Define Values" button, fill in required details for materials/sizes, approve each value.

### Issue: Update not working, creating duplicates instead
**Solution**: Ensure UPID/SKU in CSV exactly matches existing records (case-sensitive). Check for typos.

## Support

For issues or questions:
- Review this documentation thoroughly
- Check import error messages for specific guidance
- Contact system administrator for category/permission issues
- Refer to PRD documentation for technical implementation details

## Version History

- **v1.0** (2025-11-08): Initial template with comprehensive documentation
