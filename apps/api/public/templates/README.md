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
2. **sku** - Stock Keeping Unit identifier (required)

## Column Definitions

### Basic Product Fields

#### product_name (Required)
- **Type**: Text
- **Length**: 1-100 characters
- **Description**: Name of the product
- **Example**: "Organic Cotton T-Shirt"

#### sku (Required)
- **Type**: Text
- **Description**: Stock Keeping Unit - unique identifier for the variant
- **Format**: Any unique text
- **Example**: "SKU-TSH-001", "TSH-NAVY-M-2024"
- **Note**: Used to detect if product exists (for updates vs. creates)

#### description (Optional)
- **Type**: Text
- **Length**: 1-2000 characters
- **Description**: Detailed product description
- **Example**: "Premium organic cotton t-shirt with sustainable production"

#### ean (Optional)
- **Type**: Text
- **Description**: EAN-8 or EAN-13 barcode with valid checksum
- **Example**: "5901234123457"
- **Format**: 8 or 13 digits with valid checksum

#### status (Optional)
- **Type**: Text
- **Options**: "draft", "published", "archived"
- **Default**: "draft"
- **Description**: Publication status of the product

#### brand (Optional)
- **Type**: Text
- **Description**: Showcase brand name
- **Example**: "EcoWear", "GreenThreads"
- **Note**: Brand must exist in system or will need approval

### Organization Fields

#### category (Optional)
- **Type**: Text (hierarchical path)
- **Format**: Use " > " to separate hierarchy levels
- **Description**: Product category as hierarchical path
- **Example**: "Men's > Tops > T-Shirts", "Women's > Dresses"
- **Note**: Categories must exist in the system

#### season (Optional)
- **Type**: Text
- **Description**: Season or collection name
- **Example**: "SS 2025", "FW 2024", "Spring 2024"

#### colors (Optional)
- **Type**: Text (pipe-separated)
- **Format**: Multiple colors separated by pipe (|)
- **Description**: Color variants for this product
- **Example**: "Navy Blue|Forest Green", "White"
- **Note**: New colors will be auto-created if they don't exist

#### size (Optional)
- **Type**: Text
- **Description**: Size name or measurement
- **Example**: "M", "L", "XL", "32W x 32L"
- **Note**: New sizes require approval with additional details

#### tags (Optional)
- **Type**: Text (pipe-separated)
- **Format**: Multiple tags separated by pipe (|)
- **Description**: Product tags for filtering and search
- **Example**: "Organic|Sustainable|Premium"

### Environmental Impact Fields

#### carbon_footprint (Optional)
- **Type**: Number (decimal)
- **Unit**: kg CO2e
- **Description**: Carbon footprint of the product
- **Example**: "12.5", "28.7"

#### water_usage (Optional)
- **Type**: Number (decimal)
- **Unit**: Liters
- **Description**: Water consumption during production
- **Example**: "85.3", "156.2"

#### eco_claims (Optional)
- **Type**: Text (pipe-separated)
- **Format**: Multiple claims separated by pipe (|)
- **Description**: Environmental or sustainability claims (max 5)
- **Example**: "100% Organic Cotton|GOTS Certified|Carbon Neutral"
- **Note**: New eco claims will be auto-created if they don't exist

### Materials (Complex Format)

#### materials (Optional)
- **Type**: Text (complex pipe-separated format)
- **Format**: `Name:Percentage[:Country:Recyclable:CertTitle:CertNumber:CertExpiry]|NextMaterial`
- **Description**: Material composition with optional certification details

**Simple Format** (Name and Percentage only):
```
Cotton:100
Organic Cotton:75|Recycled Polyester:25
```

**Moderate Format** (with Country and Recyclability):
```
Organic Cotton:95:TR:yes|Elastane:5:DE:no
Recycled Cotton:60:PT:yes|Recycled Polyester:20:PT:yes|Elastane:20:DE:no
```

**Full Format** (with Certification):
```
Organic Cotton:95:TR:yes:GOTS:GOTS-2024-001:2026-12-31|Elastane:5
```

**Field Details**:
- **Name**: Material name (required)
- **Percentage**: 0-100 (required, must sum to 100 across all materials)
- **Country**: ISO 2-letter country code (optional, e.g., TR, IN, FR)
- **Recyclable**: "yes" or "no" (optional)
- **CertTitle**: Certification title (optional, e.g., GOTS, OEKO-TEX)
- **CertNumber**: Certification number (optional)
- **CertExpiry**: Expiry date in YYYY-MM-DD format (optional)

### Journey Steps (Complex Format)

#### journey_steps (Optional)
- **Type**: Text (complex format)
- **Format**: `StepName@Operator1,Operator2|NextStep@Operator3`
- **Description**: Supply chain journey with operators at each step

**Examples**:
```
Spinning@Eco Spinners|Weaving@Green Textiles
Fiber Production@Turkish Cotton Co|Spinning@Eco Spinners|Weaving@Green Textiles|Dyeing@Natural Dye Works
Harvesting@French Linen Fields|Spinning@Linen Masters
```

**Field Details**:
- **StepName**: Journey step name (e.g., "Spinning", "Weaving", "Dyeing")
- **Operators**: Comma-separated operator/facility names for this step
- Separate multiple steps with pipe (|)

### Image Fields

#### primary_image_url (Optional)
- **Type**: URL
- **Description**: URL to main product image
- **Example**: "https://example.com/images/tshirt-main.jpg"
- **Note**: Must be a valid, publicly accessible URL

#### additional_image_urls (Optional)
- **Type**: Text (pipe-separated URLs)
- **Format**: Multiple URLs separated by pipe (|)
- **Description**: Additional product images
- **Example**: "https://example.com/img1.jpg|https://example.com/img2.jpg"

### Legacy Fields (Backward Compatible)

The system also supports legacy column names for backward compatibility:
- `category_name` → use `category` instead
- `color_name` → use `colors` instead (pipe-separated for multiple)
- `size_name` → use `size` instead
- `upid` → use `sku` instead (both work)
- Separate material columns (`material_1_name`, `material_1_percentage`, etc.) → use `materials` instead
- Separate journey columns (`journey_step_1`, `journey_operator_1`, etc.) → use `journey_steps` instead

## Create vs Update Logic

The system automatically determines whether to create or update products based on SKU:

### Creating New Products
If the SKU in your CSV **does not exist** in the database:
- A new product and variant will be created
- All provided fields will be populated

### Updating Existing Products
If the SKU in your CSV **already exists** in the database:
- The existing product and variant will be updated
- Only fields included in the CSV will be updated
- Empty/blank fields will preserve existing values (no overwrite)
- Partial updates are supported

### Example Scenarios

**Initial Import:**
```csv
product_name,sku,description
Basic T-Shirt,SKU-001,A simple tee
```
Result: Creates new product with SKU-001

**Later Update (add materials and environmental data):**
```csv
product_name,sku,materials,carbon_footprint,water_usage
Basic T-Shirt Updated,SKU-001,Cotton:100,10.5,55.0
```
Result: Updates existing product SKU-001, adds materials and environmental data, preserves description

**Note**: The system also supports `upid` as an alternative identifier for backward compatibility.

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
product_name,sku
Classic Cotton T-Shirt,SKU-TSH-001
Slim Fit Jeans,SKU-JNS-001
Summer Dress,SKU-DRS-001
```

### Moderate Example (Create with Common Fields)
```csv
product_name,sku,description,status,category,season,colors,size
Organic Cotton T-Shirt,SKU-TSH-002,Premium organic cotton t-shirt,published,Men's > Tops > T-Shirts,SS 2025,Navy Blue|White,M
Recycled Denim Jeans,SKU-JNS-002,Comfortable jeans from recycled denim,draft,Men's > Bottoms > Jeans,FW 2024,Dark Blue,32W x 32L
```

### Full Example (Create with All Fields)
```csv
product_name,sku,description,ean,status,brand,category,season,colors,size,tags,carbon_footprint,water_usage,eco_claims,materials,journey_steps,primary_image_url,additional_image_urls
Sustainable Organic T-Shirt,SKU-ORG-001,Premium GOTS certified organic cotton tee,5901234123457,published,EcoWear,Men's > Tops > T-Shirts,SS 2025,Natural White|Earth Brown,M,Organic|Sustainable|GOTS,8.5,42.0,100% Organic Cotton|GOTS Certified|Carbon Neutral,Organic Cotton:95:IN:yes:GOTS:GOTS-2024-001:2026-12-31|Elastane:5:DE:no,Farming@Organic Farms India|Spinning@Eco Spinners|Weaving@Green Textiles|Dyeing@Natural Dye Works,https://example.com/tshirt.jpg,https://example.com/tshirt-2.jpg|https://example.com/tshirt-3.jpg
```

### Update Example (Updating Existing Products)
```csv
product_name,sku,description,carbon_footprint,water_usage
Classic Cotton T-Shirt Updated,SKU-TSH-001,Updated description with environmental metrics,10.5,55.0
```

### Mixed Example (Create and Update in One File)
```csv
product_name,sku,description,status,colors,size
New Product Alpha,SKU-NEW-001,Brand new product,published,Red|Blue,M
Updated Existing Product,SKU-TSH-001,Updating description of existing product,published,White,M
New Product Beta,SKU-NEW-002,Another new product,draft,Green,L
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
**Solution**: Ensure SKU in CSV exactly matches existing records (case-sensitive). Check for typos or extra spaces.

## Support

For issues or questions:
- Review this documentation thoroughly
- Check import error messages for specific guidance
- Contact system administrator for category/permission issues
- Refer to PRD documentation for technical implementation details

## Version History

- **v1.0** (2025-11-08): Initial template with comprehensive documentation
