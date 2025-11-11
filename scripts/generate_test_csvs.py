#!/usr/bin/env python3
"""
Test CSV Generator for Bulk Import System

Generates multiple CSV files to test different validation scenarios:
1. Valid data - all rows pass validation
2. Duplicates - duplicate UPIDs/SKUs
3. Unmapped values - colors, sizes, categories not in catalog
4. Missing required fields - missing product_name, upid/sku
5. Invalid data - field length violations, invalid formats
6. Mixed errors - combination of various issues
7. Wrong headers - incorrect column names

Each CSV contains 10,000 rows for stress testing.
"""

import csv
import random
from pathlib import Path

# Configuration
OUTPUT_DIR = Path(__file__).parent
NUM_ROWS = 10000

# Data pools for generating test data
PRODUCT_TYPES = [
    "T-Shirt", "Polo Shirt", "Tank Top", "Hoodie", "Sweater", "Cardigan",
    "Jeans", "Pants", "Shorts", "Joggers", "Dress Pants",
    "Jacket", "Coat", "Parka", "Blazer",
    "Dress", "Skirt", "Blouse"
]

MATERIALS = [
    "Cotton", "Polyester", "Wool", "Silk", "Linen", "Nylon",
    "Cashmere", "Leather", "Suede", "Denim", "Fleece",
    "Viscose", "Elastane", "Recycled Polyester"
]

STYLES = [
    "Classic", "Vintage", "Modern", "Essential", "Premium",
    "Athletic", "Casual", "Formal", "Heritage", "Limited Edition",
    "Oversized", "Slim Fit", "Regular Fit"
]

# Valid catalog values (these should exist in the database)
VALID_COLORS = ["Black", "White", "Navy", "Gray", "Beige"]
VALID_SIZES = ["XS", "S", "M", "L", "XL"]
VALID_CATEGORIES = ["Tops", "Bottoms", "Outerwear", "Dresses"]

# Unmapped values (these should NOT exist in the database)
UNMAPPED_COLORS = [
    "Coral", "Burgundy", "Orange", "Pink", "Navy Blue", "Light Gray",
    "Olive Green", "Mustard", "Teal", "Lavender", "Crimson", "Charcoal"
]
UNMAPPED_SIZES = ["2XL", "3XL", "XXS", "One Size"]
UNMAPPED_CATEGORIES = [
    "Accessories", "Footwear", "T-Shirts", "Shirts", "Activewear",
    "Loungewear", "Swimwear", "Underwear"
]

SEASONS = ["Spring 2024", "Fall 2024", "AW24", "FW24", "SS25"]

CARE_CODES = [
    "MACHINE_WASH", "HAND_WASH", "DRY_CLEAN", "DO_NOT_BLEACH",
    "TUMBLE_DRY", "DO_NOT_IRON", "IRON_LOW_HEAT"
]

ECO_CLAIMS = [
    "ORGANIC", "RECYCLED", "FAIR_TRADE", "BLUESIGN", "OEKO_TEX",
    "GOTS_CERTIFIED", "CRADLE_TO_CRADLE"
]

DESCRIPTIONS = [
    "Classic {material} {product} design meets modern comfort. Made from sustainable materials.",
    "The perfect {product} for the {season} season. Combines style with functionality.",
    "Discover the {style} {product} crafted from premium {material}. Ideal for any occasion.",
    "A comfortable and stylish {product} perfect for everyday wear. Made with high-quality {material}.",
]

def generate_upid(index):
    """Generate a unique UPID"""
    return f"UPID-{100000 + index}"

def generate_sku(index):
    """Generate a unique SKU"""
    prefix = random.choice(["TSH", "PNT", "JKT", "DRS", "SHT"])
    return f"SKU-{prefix}-{10000 + index}"

def generate_product_name():
    """Generate a product name"""
    style = random.choice(STYLES)
    material = random.choice(MATERIALS)
    product = random.choice(PRODUCT_TYPES)
    return f"{style} {material} {product}"

def generate_description():
    """Generate a product description"""
    template = random.choice(DESCRIPTIONS)
    return template.format(
        material=random.choice(MATERIALS).lower(),
        product=random.choice(PRODUCT_TYPES).lower(),
        season=random.choice(["spring", "summer", "fall", "winter"]),
        style=random.choice(STYLES).lower()
    )

def generate_image_url(product_id):
    """Generate a fake image URL"""
    domain = random.choice([
        "cdn.example.com",
        "assets.fashion-brand.com",
        "images.product-store.com"
    ])
    return f"https://{domain}/products/product-{product_id}.jpg"

def get_base_headers():
    """Get standard CSV headers"""
    return [
        'product_name', 'upid', 'sku', 'description', 'category_name', 'season',
        'primary_image_url', 'color_name', 'size_name', 'product_image_url',
        'material_1_name', 'material_1_percentage', 'material_2_name', 'material_2_percentage',
        'material_3_name', 'material_3_percentage', 'care_codes', 'eco_claims', 'environment_score'
    ]

def generate_base_row(index, use_valid_values=False):
    """Generate a base row with valid or unmapped values"""
    colors = VALID_COLORS if use_valid_values else UNMAPPED_COLORS
    sizes = VALID_SIZES if use_valid_values else UNMAPPED_SIZES
    categories = VALID_CATEGORIES if use_valid_values else UNMAPPED_CATEGORIES

    # Randomly include optional fields
    include_description = random.random() > 0.3
    include_category = random.random() > 0.2
    include_season = random.random() > 0.4
    include_images = random.random() > 0.5
    include_color = random.random() > 0.2
    include_size = random.random() > 0.2
    include_care = random.random() > 0.4
    include_eco = random.random() > 0.4
    include_env_score = random.random() > 0.3

    row = {
        'product_name': generate_product_name(),
        'upid': generate_upid(index),
        'sku': generate_sku(index),
        'description': generate_description() if include_description else '',
        'category_name': random.choice(categories) if include_category else '',
        'season': random.choice(SEASONS) if include_season else '',
        'primary_image_url': generate_image_url(index) if include_images else '',
        'color_name': random.choice(colors) if include_color else '',
        'size_name': random.choice(sizes) if include_size else '',
        'product_image_url': generate_image_url(index + 1000) if include_images and random.random() > 0.5 else '',
        'material_1_name': random.choice(MATERIALS),
        'material_1_percentage': str(random.choice([100, 95, 80, 70, 60, 50, 40, 35, 30])),
        'material_2_name': random.choice(MATERIALS) if random.random() > 0.6 else '',
        'material_2_percentage': str(random.choice([20, 15, 10, 5])) if random.random() > 0.6 else '',
        'material_3_name': '',
        'material_3_percentage': '',
        'care_codes': ','.join(random.sample(CARE_CODES, random.randint(1, 3))) if include_care else '',
        'eco_claims': ','.join(random.sample(ECO_CLAIMS, random.randint(1, 3))) if include_eco else '',
        'environment_score': str(random.randint(50, 100)) if include_env_score else '',
    }
    return row

# ============================================================================
# Test Case 1: Valid Data (All Mapped Values)
# ============================================================================
def generate_valid_csv():
    """Generate CSV with all valid, mapped values"""
    filename = OUTPUT_DIR / "test-01-valid-data.csv"
    headers = get_base_headers()

    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()

        for i in range(NUM_ROWS):
            row = generate_base_row(i, use_valid_values=True)
            writer.writerow(row)

    print(f"✓ Generated {filename.name}: {NUM_ROWS} rows with valid mapped values")

# ============================================================================
# Test Case 2: Duplicate UPIDs
# ============================================================================
def generate_duplicates_csv():
    """Generate CSV with duplicate UPIDs (validation error)"""
    filename = OUTPUT_DIR / "test-02-duplicates.csv"
    headers = get_base_headers()

    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()

        # Generate rows with intentional duplicates
        for i in range(NUM_ROWS):
            row = generate_base_row(i, use_valid_values=True)

            # Every 100th row, reuse a previous UPID (create duplicates)
            if i > 0 and i % 100 == 0:
                row['upid'] = generate_upid(i - 50)  # Duplicate from 50 rows back
                row['sku'] = generate_sku(i)  # But unique SKU

            writer.writerow(row)

    print(f"✓ Generated {filename.name}: {NUM_ROWS} rows with ~{NUM_ROWS // 100} duplicates")

# ============================================================================
# Test Case 3: Unmapped Values (All Colors, Sizes, Categories)
# ============================================================================
def generate_unmapped_csv():
    """Generate CSV with unmapped colors, sizes, and categories"""
    filename = OUTPUT_DIR / "test-03-unmapped-values.csv"
    headers = get_base_headers()

    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()

        for i in range(NUM_ROWS):
            row = generate_base_row(i, use_valid_values=False)  # Use unmapped values
            writer.writerow(row)

    print(f"✓ Generated {filename.name}: {NUM_ROWS} rows with unmapped colors, sizes, categories")

# ============================================================================
# Test Case 4: Missing Required Fields
# ============================================================================
def generate_missing_required_csv():
    """Generate CSV with missing required fields"""
    filename = OUTPUT_DIR / "test-04-missing-required.csv"
    headers = get_base_headers()

    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()

        for i in range(NUM_ROWS):
            row = generate_base_row(i, use_valid_values=True)

            # Introduce errors in 20% of rows
            if i % 5 == 0:
                error_type = i % 3
                if error_type == 0:
                    row['product_name'] = ''  # Missing product name
                elif error_type == 1:
                    row['upid'] = ''  # Missing UPID
                    row['sku'] = ''   # Missing SKU
                elif error_type == 2:
                    row['upid'] = ''  # Missing UPID only

            writer.writerow(row)

    print(f"✓ Generated {filename.name}: {NUM_ROWS} rows with ~{NUM_ROWS // 5} missing required fields")

# ============================================================================
# Test Case 5: Field Length Violations
# ============================================================================
def generate_field_length_violations_csv():
    """Generate CSV with field length violations"""
    filename = OUTPUT_DIR / "test-05-field-length-violations.csv"
    headers = get_base_headers()

    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()

        for i in range(NUM_ROWS):
            row = generate_base_row(i, use_valid_values=True)

            # Introduce length violations in 10% of rows
            if i % 10 == 0:
                if i % 20 == 0:
                    # Product name too long (>100 chars)
                    row['product_name'] = "A" * 150
                else:
                    # Description too long (>2000 chars)
                    row['description'] = "B" * 2500

            writer.writerow(row)

    print(f"✓ Generated {filename.name}: {NUM_ROWS} rows with ~{NUM_ROWS // 10} length violations")

# ============================================================================
# Test Case 6: Wrong Headers
# ============================================================================
def generate_wrong_headers_csv():
    """Generate CSV with incorrect header names"""
    filename = OUTPUT_DIR / "test-06-wrong-headers.csv"

    # Intentionally wrong headers
    wrong_headers = [
        'ProductName', 'UPID', 'SKU', 'Description', 'Category', 'Season',
        'PrimaryImage', 'ColorName', 'SizeName', 'ProductImage',
        'Material1', 'Material1Pct', 'Material2', 'Material2Pct',
        'Material3', 'Material3Pct', 'CareCodes', 'EcoClaims', 'EnvScore'
    ]

    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=wrong_headers)
        writer.writeheader()

        correct_headers = get_base_headers()
        for i in range(NUM_ROWS):
            row = generate_base_row(i, use_valid_values=True)
            # Map to wrong header names
            wrong_row = {wrong: row[correct] for wrong, correct in zip(wrong_headers, correct_headers)}
            writer.writerow(wrong_row)

    print(f"✓ Generated {filename.name}: {NUM_ROWS} rows with incorrect headers")

# ============================================================================
# Test Case 7: Mixed Errors
# ============================================================================
def generate_mixed_errors_csv():
    """Generate CSV with a mix of all error types"""
    filename = OUTPUT_DIR / "test-07-mixed-errors.csv"
    headers = get_base_headers()

    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()

        for i in range(NUM_ROWS):
            # Mix of valid and unmapped values
            use_valid = random.random() > 0.5
            row = generate_base_row(i, use_valid_values=use_valid)

            # Introduce various errors randomly
            error_roll = random.random()

            if error_roll < 0.05:  # 5% duplicates
                if i > 100:
                    row['upid'] = generate_upid(i - random.randint(50, 100))
            elif error_roll < 0.10:  # 5% missing required
                if random.random() > 0.5:
                    row['product_name'] = ''
                else:
                    row['upid'] = ''
                    row['sku'] = ''
            elif error_roll < 0.12:  # 2% length violations
                if random.random() > 0.5:
                    row['product_name'] = "X" * 150
                else:
                    row['description'] = "Y" * 2500

            writer.writerow(row)

    print(f"✓ Generated {filename.name}: {NUM_ROWS} rows with mixed errors")

# ============================================================================
# Test Case 8: Minimal Valid Data
# ============================================================================
def generate_minimal_csv():
    """Generate CSV with only required fields populated"""
    filename = OUTPUT_DIR / "test-08-minimal-required.csv"
    headers = get_base_headers()

    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()

        for i in range(NUM_ROWS):
            row = {header: '' for header in headers}
            row['product_name'] = generate_product_name()
            row['upid'] = generate_upid(i)
            row['sku'] = generate_sku(i)
            row['material_1_name'] = random.choice(MATERIALS)
            row['material_1_percentage'] = '100'

            writer.writerow(row)

    print(f"✓ Generated {filename.name}: {NUM_ROWS} rows with minimal required fields")

# ============================================================================
# Test Case 9: Empty File
# ============================================================================
def generate_empty_csv():
    """Generate CSV with only headers (no data rows)"""
    filename = OUTPUT_DIR / "test-09-empty.csv"
    headers = get_base_headers()

    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()

    print(f"✓ Generated {filename.name}: Headers only, no data rows")

# ============================================================================
# Test Case 10: Large Mixed Dataset
# ============================================================================
def generate_large_mixed_csv():
    """Generate large CSV with realistic mix of valid and unmapped data"""
    filename = OUTPUT_DIR / "test-10-large-mixed.csv"
    headers = get_base_headers()

    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()

        for i in range(NUM_ROWS):
            # 70% use unmapped values, 30% use valid values
            use_valid = random.random() < 0.3
            row = generate_base_row(i, use_valid_values=use_valid)
            writer.writerow(row)

    print(f"✓ Generated {filename.name}: {NUM_ROWS} rows (70% unmapped, 30% valid)")

# ============================================================================
# Main
# ============================================================================
def main():
    """Generate all test CSV files"""
    print("=" * 70)
    print("Bulk Import Test CSV Generator")
    print("=" * 70)
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Rows per file: {NUM_ROWS:,}")
    print()

    # Generate all test files
    generate_valid_csv()
    generate_duplicates_csv()
    generate_unmapped_csv()
    generate_missing_required_csv()
    generate_field_length_violations_csv()
    generate_wrong_headers_csv()
    generate_mixed_errors_csv()
    generate_minimal_csv()
    generate_empty_csv()
    generate_large_mixed_csv()

    print()
    print("=" * 70)
    print("✓ All test files generated successfully!")
    print("=" * 70)
    print()
    print("Test files created:")
    print("  01. test-01-valid-data.csv          - All valid mapped values")
    print("  02. test-02-duplicates.csv          - Duplicate UPIDs (~1% duplicates)")
    print("  03. test-03-unmapped-values.csv     - All unmapped colors/sizes/categories")
    print("  04. test-04-missing-required.csv    - Missing required fields (~20%)")
    print("  05. test-05-field-length-violations.csv - Field length violations (~10%)")
    print("  06. test-06-wrong-headers.csv       - Incorrect header names")
    print("  07. test-07-mixed-errors.csv        - Mix of all error types")
    print("  08. test-08-minimal-required.csv    - Only required fields populated")
    print("  09. test-09-empty.csv               - Headers only, no data")
    print("  10. test-10-large-mixed.csv         - Realistic mix (70% unmapped)")
    print()

if __name__ == "__main__":
    main()
